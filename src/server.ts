import 'dotenv/config';

import express, { Application } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimit';

// Import routes
import authRoutes from './routes/auth.routes';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import adminRoutes from './routes/admin.routes';
import stockRoutes from './routes/stock.routes';
import productRoutes from './routes/product.routes';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// ── Reverse-proxy trust (CRITICAL fix for the "Nginx proxy trap" global DoS) ──
// Behind a reverse proxy (Nginx, load balancer), Express sees the proxy's IP for
// every request unless `trust proxy` is configured. With it unset, all clients
// share one IP bucket, so the per-IP rate limiter collapses into a GLOBAL limiter
// and a single client (e.g. 5 failed logins) can lock out every user.
//
// We use a NUMERIC hop count (never `true`): `true` would trust a client-supplied
// X-Forwarded-For header, letting attackers spoof IPs to evade rate limiting.
const trustProxyHops = Number(
  process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === 'production' ? 1 : 0)
);
app.set('trust proxy', Number.isFinite(trustProxyHops) ? trustProxyHops : 1);

// Security middleware
app.use(helmet());

// CORS configuration
// Allow the configured frontend URL plus its www/non-www variant so users
// landing on either domain can authenticate. credentials=true means the
// Access-Control-Allow-Origin header can never be '*'.
const allowedOrigins = (() => {
  const configured = process.env.FRONTEND_URL?.trim();
  const origins = new Set<string>();
  if (configured) {
    origins.add(configured);
    try {
      const url = new URL(configured);
      const hostname = url.hostname;
      if (hostname.startsWith('www.')) {
        origins.add(`${url.protocol}//${hostname.slice(4)}${url.port ? ':' + url.port : ''}`);
      } else if (hostname && !['localhost', '127.0.0.1'].includes(hostname)) {
        origins.add(`${url.protocol}//www.${hostname}${url.port ? ':' + url.port : ''}`);
      }
    } catch {
      // Not a valid URL; keep only the configured value
    }
  } else {
    origins.add('http://localhost:3000');
  }
  return Array.from(origins);
})();

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, same-origin server components)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser with security guard
const COOKIE_SECRET = process.env.COOKIE_SECRET;
if (!COOKIE_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: COOKIE_SECRET environment variable is required in production');
  process.exit(1);
}
if (!COOKIE_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('WARNING: COOKIE_SECRET not set. Using unsigned cookies in development.');
}
app.use(cookieParser(COOKIE_SECRET));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Global rate limiting for all API routes (baseline DoS protection).
// Keyed on the real client IP thanks to the `trust proxy` setting above.
// Stricter per-endpoint limits (e.g. auth) are layered on top in their routers.
app.use('/api', rateLimiter);

// Serve uploaded images as static files
app.use('/uploads', express.static(path.join(process.cwd(), '..', 'public', 'uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/products', productRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API URL: ${process.env.API_URL || `http://localhost:${PORT}`}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`🍪 Cookie SameSite: ${process.env.COOKIE_SAMESITE || 'lax'}`);
  if (process.env.NODE_ENV === 'production' && (process.env.COOKIE_SAMESITE || 'lax').toLowerCase() !== 'none') {
    console.warn('⚠️  WARNING: If the frontend is hosted on a different origin than the API, set COOKIE_SAMESITE=none or auth cookies will not be sent on cross-site requests.');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

export default app;
