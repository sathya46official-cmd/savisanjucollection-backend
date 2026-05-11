# SaviSanju Collections - Backend API

Production-grade Express.js REST API for luxury saree e-commerce platform with JWT authentication, PostgreSQL database, and comprehensive security features.

---

## 🏗️ Architecture

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 16 (Docker locally, Oracle Cloud production)
- **Authentication**: JWT with httpOnly cookies
- **Password Hashing**: bcrypt (10 salt rounds)
- **Validation**: Zod schemas
- **Email**: Resend (3,000 emails/month free tier)
- **Push Notifications**: Firebase Cloud Messaging (FCM) - 100% FREE
- **Security**: Rate limiting, CORS, Helmet.js, input validation

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts          # PostgreSQL connection pool
│   ├── controllers/
│   │   └── auth.controller.ts   # Authentication logic
│   ├── middleware/
│   │   ├── auth.ts              # JWT verification
│   │   ├── errorHandler.ts     # Global error handling
│   │   ├── notFoundHandler.ts  # 404 handler
│   │   ├── rateLimit.ts        # Rate limiting (100 req/15min)
│   │   └── requestLogger.ts    # Request logging
│   ├── routes/
│   │   ├── auth.routes.ts      # Auth endpoints
│   │   ├── cart.routes.ts      # Shopping cart
│   │   ├── order.routes.ts     # Order management
│   │   ├── admin.routes.ts     # Admin dashboard
│   │   └── stock.routes.ts     # Stock notifications
│   ├── services/
│   │   ├── email.ts            # Resend email service
│   │   └── README.md           # Email service docs
│   ├── utils/
│   │   ├── jwt.ts              # JWT utilities
│   │   ├── password.ts         # bcrypt utilities
│   │   └── validation.ts       # Zod schemas
│   ├── __tests__/
│   │   ├── auth.test.ts        # Auth tests
│   │   └── email.test.ts       # Email tests
│   └── server.ts               # Express app entry point
├── migrations/
│   ├── 001_initial_schema.sql
│   └── 002_security_architecture_overhaul.sql
├── docker-compose.yml           # Docker setup (PostgreSQL)
├── Dockerfile                   # Production container
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js 18+** (LTS recommended)
- **Docker Desktop** (for PostgreSQL)
- **Git**

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/savisanju-backend.git
cd savisanju-backend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Environment Setup

Create `.env` file in the `backend/` directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server
NODE_ENV=development
PORT=5000

# Database (Docker PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/savisanju

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-random-256-bit-secret-here

# Admin Password (generate hash with bcrypt)
ADMIN_PASSWORD_HASH=$2b$10$your-bcrypt-hashed-password-here

# Email Service (Resend)
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@savisanju.com
RESEND_ADMIN_EMAIL=admin@savisanju.com

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
```

### Step 4: Generate Secrets

#### Generate JWT Secret
```bash
openssl rand -base64 32
```

#### Generate Admin Password Hash
```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YourAdminPassword123', 10, (err, hash) => console.log(hash));"
```

Copy the generated hash to `ADMIN_PASSWORD_HASH` in `.env`

### Step 5: Start PostgreSQL (Docker)

```bash
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432` with:
- **Database**: `savisanju`
- **Username**: `postgres`
- **Password**: `postgres`

Verify PostgreSQL is running:
```bash
docker ps
```

### Step 6: Run Database Migrations

```bash
# Connect to PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/savisanju

# Run migrations
\i migrations/001_initial_schema.sql
\i migrations/002_security_architecture_overhaul.sql

# Verify tables created
\dt

# Exit psql
\q
```

Or run migrations directly:
```bash
psql postgresql://postgres:postgres@localhost:5432/savisanju -f migrations/001_initial_schema.sql
psql postgresql://postgres:postgres@localhost:5432/savisanju -f migrations/002_security_architecture_overhaul.sql
```

### Step 7: Start Development Server

```bash
npm run dev
```

Backend API runs on **http://localhost:5000**

You should see:
```
🚀 Server running on port 5000
✅ Database connected successfully
```

### Step 8: Test API

```bash
# Health check
curl http://localhost:5000/health

# Expected response:
# {"status":"ok","timestamp":"2026-05-03T..."}
```

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | User registration | No |
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/logout` | Logout | Yes |
| GET | `/api/auth/verify-email` | Email verification | No |
| POST | `/api/admin/login` | Admin login | No |

### Shopping Cart

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/cart` | Get user cart | Yes (User) |
| POST | `/api/cart/add` | Add item to cart | Yes (User) |
| PUT | `/api/cart/update` | Update cart item quantity | Yes (User) |
| DELETE | `/api/cart/remove` | Remove cart item | Yes (User) |

### Orders

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/orders/create` | Create order (with stock reservation) | Yes (User) |
| GET | `/api/orders/history` | Get user order history | Yes (User) |
| PUT | `/api/orders/:id/cancel` | Cancel order | Yes (User) |

### Admin

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/admin/orders` | Get all orders (with polling support) | Yes (Admin) |
| PUT | `/api/admin/orders/:id/status` | Update order status | Yes (Admin) |
| PUT | `/api/admin/stock/:variantId` | Update stock quantity | Yes (Admin) |

### Stock Notifications

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/stock/notify` | Request stock notification | No |

### Products

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/products` | Get all products | No |
| GET | `/api/products/:id` | Get product details | No |

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Specific Test File

```bash
npm test auth.test.ts
```

---

## 🐳 Docker Deployment

### Build Docker Image

```bash
docker build -t savisanju-backend .
```

### Run Container

```bash
docker run -p 5000:5000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  -e ADMIN_PASSWORD_HASH=... \
  -e RESEND_API_KEY=... \
  -e FRONTEND_URL=https://savisanju.com \
  savisanju-backend
```

### Full Stack with Docker Compose

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Backend API on port 5000

---

## 🌐 Production Deployment (Oracle Cloud VPS)

### Step 1: Setup Oracle Cloud VPS

1. Create Oracle Cloud Free Tier account
2. Launch Ubuntu 22.04 VM instance
3. Configure security list to allow ports 80, 443, 5000

### Step 2: Connect to VPS

```bash
ssh ubuntu@your-oracle-vps-ip
```

### Step 3: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 16
sudo apt install -y postgresql-16 postgresql-contrib-16

# Install Git
sudo apt install -y git

# Install PM2 (process manager)
sudo npm install -g pm2
```

### Step 4: Setup PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE savisanju;
CREATE USER savisanju_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE savisanju TO savisanju_user;
\q
```

### Step 5: Clone and Setup Backend

```bash
# Clone repository
git clone https://github.com/yourusername/savisanju-backend.git
cd savisanju-backend

# Install dependencies
npm install

# Create .env file
nano .env
```

Add production environment variables:
```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://savisanju_user:your-secure-password@localhost:5432/savisanju
JWT_SECRET=your-production-jwt-secret
ADMIN_PASSWORD_HASH=your-production-admin-hash
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@savisanju.com
RESEND_ADMIN_EMAIL=admin@savisanju.com
FRONTEND_URL=https://savisanju.com
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
```

### Step 6: Run Migrations

```bash
psql postgresql://savisanju_user:your-secure-password@localhost:5432/savisanju -f migrations/001_initial_schema.sql
psql postgresql://savisanju_user:your-secure-password@localhost:5432/savisanju -f migrations/002_security_architecture_overhaul.sql
```

### Step 7: Build and Start

```bash
# Build TypeScript
npm run build

# Start with PM2
pm2 start dist/server.js --name savisanju-api

# Configure PM2 to start on boot
pm2 startup
pm2 save
```

### Step 8: Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/savisanju-api
```

Add configuration:
```nginx
server {
    listen 80;
    server_name api.savisanju.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/savisanju-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 9: Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.savisanju.com

# Auto-renewal is configured automatically
```

### Step 10: Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## 📊 Monitoring & Maintenance

### View Logs

```bash
# PM2 logs
pm2 logs savisanju-api

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

### Monitor Process

```bash
# PM2 monitoring
pm2 monit

# Check status
pm2 status

# Restart if needed
pm2 restart savisanju-api
```

### Database Backup

```bash
# Create backup
pg_dump -U savisanju_user savisanju > backup_$(date +%Y%m%d).sql

# Restore backup
psql -U savisanju_user savisanju < backup_20260503.sql
```

### Update Application

```bash
cd savisanju-backend
git pull
npm install
npm run build
pm2 restart savisanju-api
```

---

## 🔒 Security Features

- ✅ **JWT Authentication** with httpOnly cookies (24h expiration)
- ✅ **bcrypt Password Hashing** (10 salt rounds)
- ✅ **Rate Limiting** (100 requests per 15 minutes per IP)
- ✅ **CORS Configuration** (whitelist frontend domain)
- ✅ **Helmet.js Security Headers** (XSS, clickjacking protection)
- ✅ **Input Validation** with Zod schemas
- ✅ **SQL Injection Prevention** (parameterized queries)
- ✅ **Database Transactions** for stock management
- ✅ **Row-Level Locking** for race condition prevention
- ✅ **Environment Variable Protection** (no credentials in code)

---

## 📝 Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | `development` or `production` |
| `PORT` | Server port | Yes | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | JWT signing secret (256-bit) | Yes | Generate with `openssl rand -base64 32` |
| `ADMIN_PASSWORD_HASH` | Bcrypt-hashed admin password | Yes | Generate with bcrypt |
| `RESEND_API_KEY` | Resend email API key | Yes | `re_...` |
| `RESEND_FROM_EMAIL` | Sender email address | Yes | `noreply@savisanju.com` |
| `RESEND_ADMIN_EMAIL` | Admin notification email | Yes | `admin@savisanju.com` |
| `FRONTEND_URL` | Frontend URL for CORS | Yes | `http://localhost:3000` |
| `RATE_LIMIT_MAX` | Max requests per window | No | `100` (default) |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | No | `900000` (15 min, default) |

---

## 🆘 Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker ps  # For Docker
sudo systemctl status postgresql  # For system PostgreSQL

# Test connection
psql $DATABASE_URL

# Check DATABASE_URL format
echo $DATABASE_URL
```

### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>
```

### Migration Errors

```bash
# Check current schema
psql $DATABASE_URL -c "\dt"

# Rollback migration (if needed)
psql $DATABASE_URL -f migrations/rollback.sql

# Re-run migration
psql $DATABASE_URL -f migrations/002_security_architecture_overhaul.sql
```

### Email Not Sending

```bash
# Check Resend API key
curl https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"noreply@savisanju.com","to":"test@example.com","subject":"Test","html":"<p>Test</p>"}'

# Check Resend dashboard for delivery status
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🆘 Support

For issues or questions:
- **Email**: support@savisanju.com
- **GitHub Issues**: [Create Issue](https://github.com/yourusername/savisanju-backend/issues)

---

**Built with ❤️ for SaviSanju Collections**
