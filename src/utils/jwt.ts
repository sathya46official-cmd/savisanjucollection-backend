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

type SameSiteMode = 'lax' | 'strict' | 'none';

/**
 * Resolve the cookie SameSite mode.
 *
 * Default is 'lax' (secure, works when frontend & API share a registrable
 * domain, e.g. app.example.com + api.example.com). If the frontend is on a
 * DIFFERENT site than the API (e.g. *.vercel.app frontend + api.example.com
 * backend), browsers will NOT send a Lax cookie on cross-site fetch/XHR, so the
 * auth cookie must be SameSite=None. Set COOKIE_SAMESITE=none for that case.
 * SameSite=None REQUIRES Secure (HTTPS) — enforced below.
 */
function resolveSameSite(): SameSiteMode {
  const v = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  return v === 'none' || v === 'strict' ? v : 'lax';
}

/**
 * Shared auth-cookie attributes. The SAME attributes must be used to set and to
 * clear the cookie, otherwise clearing silently fails.
 */
export const getAuthCookieOptions = () => {
  const sameSite = resolveSameSite();
  // Browsers reject SameSite=None without Secure. Also always Secure in prod.
  const secure = sameSite === 'none' ? true : process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/' as const,
  };
};

export const generateAuthCookie = (token: string) => {
  return {
    name: 'auth_token',
    value: token,
    options: {
      ...getAuthCookieOptions(),
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  };
};
