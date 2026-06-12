import { Request, Response } from 'express';
import { registerSchema, loginSchema } from '../utils/validation';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken, generateAuthCookie } from '../utils/jwt';
import { query, transaction } from '../config/database';
import { sendVerificationEmail } from '../services/email';
import { z } from 'zod';

/**
 * POST /api/auth/register
 * Register a new user with email verification
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input with registerSchema
    const validated = registerSchema.parse(req.body);

    // Check if user exists (email uniqueness)
    const existingUserResult = await query(
      'SELECT id FROM user_profiles WHERE email = $1',
      [validated.email]
    );

    if (existingUserResult.rows.length > 0) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // Hash password with bcrypt
    const passwordHash = await hashPassword(validated.password);

    let userId: string = '';

    // Create user profile and auth record in transaction
    await transaction(async (client) => {
      // Insert user profile
      const userProfileResult = await client.query(
        `INSERT INTO user_profiles (email, name, default_phone, email_verified)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [validated.email, validated.name, validated.phone, false]
      );

      userId = userProfileResult.rows[0].id;

      // Insert auth record with hashed password
      await client.query(
        `INSERT INTO user_auth (user_id, password_hash)
         VALUES ($1, $2)`,
        [userId, passwordHash]
      );
    });

    // Send verification email
    await sendVerificationEmail(validated.email, userId!);

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.'
    });
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
      return;
    }

    // Handle duplicate email error (database constraint)
    if ((error as any).code === '23505') {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // Server errors
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again later.' });
  }
};

/**
 * POST /api/auth/login
 * Authenticate user and generate JWT token
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input with loginSchema
    const validated = loginSchema.parse(req.body);

    // Find user by email
    const userResult = await query(
      `SELECT up.id, up.email, up.name, up.role, ua.password_hash
       FROM user_profiles up
       INNER JOIN user_auth ua ON up.id = ua.user_id
       WHERE up.email = $1`,
      [validated.email]
    );

    // Check if user exists
    if (userResult.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = userResult.rows[0];

    // Verify password hash
    const isValidPassword = await verifyPassword(validated.password, user.password_hash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token. Role is derived strictly from the trusted DB column,
    // never from the request or an email comparison.
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role === 'admin' ? 'admin' : 'user'
    });

    // Set httpOnly cookie
    const cookie = generateAuthCookie(token);
    res.cookie(cookie.name, cookie.value, cookie.options);

    // Return success with user info
    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
      return;
    }

    // Server errors
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again later.' });
  }
};

/**
 * GET /api/auth/verify
 * Verify JWT token (for middleware authentication)
 */
export const verify = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get auth token from cookies
    const authToken = req.cookies.auth_token;

    if (!authToken) {
      res.status(401).json({ error: 'No authentication token' });
      return;
    }

    // Verify token
    const { verifyToken } = require('../utils/jwt');
    const payload = verifyToken(authToken);

    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Return payload
    res.status(200).json({
      valid: true,
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
};

/**
 * POST /api/admin/login
 * Admin authentication with JWT token
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input with loginSchema
    const validated = loginSchema.parse(req.body);

    // Find admin user by email
    const userResult = await query(
      `SELECT up.id, up.email, up.name, up.role, ua.password_hash
       FROM user_profiles up
       INNER JOIN user_auth ua ON up.id = ua.user_id
       WHERE up.email = $1`,
      [validated.email]
    );

    // Check if user exists
    if (userResult.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = userResult.rows[0];

    // Authorization is based ONLY on the trusted `role` column in the database.
    // We intentionally do NOT grant admin based on a matching email address,
    // because the admin email is a guessable/configurable value and email-based
    // checks enabled an admin-account-takeover path.
    const isAdmin = user.role === 'admin';
    if (!isAdmin) {
      // Verify the password before responding so the error/timing is identical
      // whether or not the account is an admin (avoids admin-account enumeration).
      await verifyPassword(validated.password, user.password_hash);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password hash
    const isValidPassword = await verifyPassword(validated.password, user.password_hash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token with admin role
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: 'admin'
    });

    // Set httpOnly cookie
    const cookie = generateAuthCookie(token);
    res.cookie(cookie.name, cookie.value, cookie.options);

    // Return success with user info
    res.status(200).json({
      message: 'Admin login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'admin'
      }
    });
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
      return;
    }

    // Server errors
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again later.' });
  }
};
