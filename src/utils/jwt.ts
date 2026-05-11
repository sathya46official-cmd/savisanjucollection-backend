import * as jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';

// Fail fast in production if JWT_SECRET is not set
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production');
  }
  console.warn('⚠️  WARNING: JWT_SECRET is not set. Using insecure default. Set JWT_SECRET before deploying.');
}

const SECRET = JWT_SECRET || 'dev-only-insecure-secret-change-before-deploy';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

export const signToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, SECRET as string, {
    expiresIn: JWT_EXPIRES_IN
  } as SignOptions);
};

export const verifyToken = (token: string): JWTPayload | null => {
  try {
    const decoded = jwt.verify(token, SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

export const generateAuthCookie = (token: string) => {
  return {
    name: 'auth_token',
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    }
  };
};
