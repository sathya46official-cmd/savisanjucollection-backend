import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';

// In-memory store for development
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // 100 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000)
    });
  }
});

// Stricter rate limit for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true
});

// Redis-based rate limiter (for production)
let redisClient: ReturnType<typeof createClient> | null = null;

export const initRedis = async () => {
  if (process.env.REDIS_URL) {
    try {
      redisClient = createClient({
        url: process.env.REDIS_URL
      });
      
      await redisClient.connect();
      console.log('✅ Redis connected for rate limiting');
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      console.log('⚠️  Falling back to in-memory rate limiting');
    }
  }
};

export const getRedisClient = () => redisClient;
