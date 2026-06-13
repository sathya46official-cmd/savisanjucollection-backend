import { Router } from 'express';
import { authRateLimiter } from '../middleware/rateLimit';
import { register, login, verify, adminLogin, resendVerification } from '../controllers/auth.controller';

const router = Router();

// POST /api/auth/register - User registration with email verification
router.post('/register', authRateLimiter, register);

// POST /api/auth/login - User login with JWT authentication
router.post('/login', authRateLimiter, login);

// POST /api/auth/resend-verification - Re-issue an email verification link (generic response)
router.post('/resend-verification', authRateLimiter, resendVerification);

// POST /api/admin/login - Admin login with JWT authentication
router.post('/admin/login', authRateLimiter, adminLogin);

// GET /api/auth/verify - Verify JWT token (for middleware)
router.get('/verify', verify);

// POST /api/auth/logout - User logout (clear auth cookie)
router.post('/logout', (req, res) => {
  const { getAuthCookieOptions } = require('../utils/jwt');
  res.clearCookie('auth_token', getAuthCookieOptions());
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/verify-email?token=xxx - Email verification
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Verification token is required' });
      return;
    }

    const { query: dbQuery } = await import('../config/database');

    // Find token in database
    const tokenResult = await dbQuery(
      `SELECT user_id, expires_at FROM email_verification_tokens WHERE token = $1`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or already used verification token' });
      return;
    }

    const { user_id, expires_at } = tokenResult.rows[0];

    // Check if token expired
    if (new Date() > new Date(expires_at)) {
      res.status(400).json({ error: 'Verification token has expired. Please register again.' });
      return;
    }

    // Mark user as verified and delete token in one go
    await dbQuery(`UPDATE user_profiles SET email_verified = true WHERE id = $1`, [user_id]);
    await dbQuery(`DELETE FROM email_verification_tokens WHERE token = $1`, [token]);

    res.status(200).json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// GET /api/auth/profile - Get authenticated user profile
router.get('/profile', async (req, res) => {
  try {
    const { verifyToken } = await import('../utils/jwt');
    const authToken = req.cookies?.auth_token;

    if (!authToken) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const payload = verifyToken(authToken);
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const { query: dbQuery } = await import('../config/database');
    const result = await dbQuery(
      `SELECT id, email, name, default_phone, address_line1, address_line2,
              city, state, postal_code, country, email_verified
       FROM user_profiles WHERE id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
