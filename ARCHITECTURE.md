# SaviSanju Backend Architecture

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Next.js 15 App Router                             │    │
│  │  - React Components                                │    │
│  │  - Server-Side Rendering (SSR)                     │    │
│  │  - Static Site Generation (SSG)                    │    │
│  │  - API Client (axios/fetch)                        │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS REST API
                            │ (CORS enabled)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           ORACLE CLOUD VPS (Backend)                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Express.js API Server (Node.js 20 + TypeScript)  │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │  Middleware Layer                            │ │    │
│  │  │  - CORS                                      │ │    │
│  │  │  - Helmet (Security Headers)                │ │    │
│  │  │  - Rate Limiting                            │ │    │
│  │  │  - JWT Authentication                       │ │    │
│  │  │  - Request Logging                          │ │    │
│  │  │  - Error Handling                           │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │  API Routes                                  │ │    │
│  │  │  - /api/auth (register, login, logout)      │ │    │
│  │  │  - /api/cart (CRUD operations)              │ │    │
│  │  │  - /api/orders (create, history, cancel)    │ │    │
│  │  │  - /api/admin (orders, stock management)    │ │    │
│  │  │  - /api/stock (notifications)               │ │    │
│  │  │  - /api/products (catalog)                  │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │  Business Logic                              │ │    │
│  │  │  - Controllers                               │ │    │
│  │  │  - Services (Email, Notifications)          │ │    │
│  │  │  - Validation (Zod schemas)                 │ │    │
│  │  │  - Utils (JWT, bcrypt, UUID)                │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
│                            │                                │
│  ┌────────────────────────────────────────────────────┐    │
│  │  PostgreSQL 16 Database                            │    │
│  │  - user_profiles, user_auth                        │    │
│  │  - products, product_variants                      │    │
│  │  - cart, cart_items                                │    │
│  │  - orders                                          │    │
│  │  - stock_notifications                             │    │
│  │  - Indexes for performance                         │    │
│  │  - Triggers for updated_at                         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Redis (Optional)                                  │    │
│  │  - Rate limiting store                             │    │
│  │  - Session cache                                   │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ External Services
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  External Services                                          │
│  - Resend (Email notifications)                             │
│  - Firebase Cloud Messaging (Push notifications)            │
└─────────────────────────────────────────────────────────────┘
```

## 📂 Directory Structure

```
backend/
├── src/
│   ├── routes/              # API route definitions
│   │   ├── auth.routes.ts   # Authentication endpoints
│   │   ├── cart.routes.ts   # Shopping cart endpoints
│   │   ├── order.routes.ts  # Order management endpoints
│   │   ├── admin.routes.ts  # Admin endpoints
│   │   ├── stock.routes.ts  # Stock notification endpoints
│   │   └── product.routes.ts # Product catalog endpoints
│   │
│   ├── middleware/          # Express middleware
│   │   ├── auth.ts          # JWT authentication & authorization
│   │   ├── rateLimit.ts     # Rate limiting (in-memory & Redis)
│   │   ├── errorHandler.ts  # Global error handling
│   │   ├── notFoundHandler.ts # 404 handler
│   │   └── requestLogger.ts # Request logging
│   │
│   ├── utils/               # Utility functions
│   │   ├── jwt.ts           # JWT signing & verification
│   │   ├── password.ts      # bcrypt hashing & validation
│   │   └── validation.ts    # Zod schemas
│   │
│   ├── config/              # Configuration
│   │   └── database.ts      # PostgreSQL connection pool
│   │
│   ├── services/            # External services (TODO)
│   │   ├── email.ts         # Resend email service
│   │   └── notifications.ts # Firebase Cloud Messaging
│   │
│   └── server.ts            # Express app entry point
│
├── migrations/              # Database migrations
│   └── 001_initial_schema.sql
│
├── scripts/                 # Utility scripts
│   └── setup.sh             # Setup script
│
├── docker-compose.yml       # Docker setup (PostgreSQL + Redis)
├── Dockerfile               # Production container
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript configuration
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
├── README.md                # Documentation
└── ARCHITECTURE.md          # This file
```

## 🔐 Security Features

### 1. Authentication & Authorization
- **JWT Tokens**: Stateless authentication with HS256 algorithm
- **httpOnly Cookies**: Prevents XSS attacks
- **bcrypt Hashing**: 10 salt rounds for password security
- **Role-Based Access**: User vs Admin permissions
- **Token Expiration**: 24-hour token lifetime

### 2. API Security
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for specific frontend origin
- **Helmet.js**: Security headers (XSS, clickjacking, etc.)
- **Input Validation**: Zod schemas for all inputs
- **SQL Injection Prevention**: Parameterized queries only

### 3. Data Security
- **Password Hashing**: Never store plaintext passwords
- **Secure Cookies**: httpOnly, secure, sameSite flags
- **Environment Variables**: Sensitive data in .env
- **Database Transactions**: ACID compliance for critical operations
- **Row-Level Locking**: Prevents race conditions in stock management

## 🗄️ Database Schema

### Tables

1. **user_profiles**
   - User information (name, email, address)
   - Email verification status
   - Timestamps

2. **user_auth**
   - Password hashes
   - Linked to user_profiles

3. **products**
   - Product catalog
   - Name, description, category

4. **product_variants**
   - Color, size, price
   - **Stock quantity** (NEW)
   - Negotiable flag

5. **cart**
   - User shopping carts
   - One cart per user

6. **cart_items**
   - Items in carts
   - Quantity per item
   - Unique constraint (cart_id, variant_id)

7. **orders**
   - Order details
   - **Status workflow** (pending → confirmed → processing → shipped → delivered → cancelled)
   - **Admin notes** (NEW)
   - **Confirmed price** (NEW)
   - Delivery address

8. **stock_notifications**
   - "Notify Me" requests
   - Email notifications when back in stock

### Indexes
- Performance indexes on frequently queried columns
- Foreign key indexes
- Composite indexes for complex queries

### Triggers
- Auto-update `updated_at` timestamps
- Audit logging (optional)

## 🔄 API Flow Examples

### 1. User Registration & Login

```
Client                    Backend                   Database
  │                         │                          │
  ├─ POST /api/auth/register ─────────────────────────>│
  │                         │                          │
  │                         ├─ Validate input (Zod)   │
  │                         ├─ Hash password (bcrypt) │
  │                         ├─ Create user ───────────>│
  │                         │<─ User created ──────────┤
  │                         ├─ Send verification email│
  │<─ 201 Created ──────────┤                          │
  │                         │                          │
  ├─ POST /api/auth/login ────────────────────────────>│
  │                         │                          │
  │                         ├─ Validate input         │
  │                         ├─ Query user ────────────>│
  │                         │<─ User data ─────────────┤
  │                         ├─ Verify password        │
  │                         ├─ Generate JWT           │
  │                         ├─ Set httpOnly cookie    │
  │<─ 200 OK + Cookie ──────┤                          │
```

### 2. Add to Cart & Checkout

```
Client                    Backend                   Database
  │                         │                          │
  ├─ POST /api/cart/add ──────────────────────────────>│
  │  (JWT in cookie)        │                          │
  │                         ├─ Verify JWT             │
  │                         ├─ Check stock ───────────>│
  │                         │<─ Stock available ───────┤
  │                         ├─ Add to cart ───────────>│
  │                         │<─ Cart updated ──────────┤
  │<─ 200 OK ───────────────┤                          │
  │                         │                          │
  ├─ POST /api/orders/create ─────────────────────────>│
  │                         │                          │
  │                         ├─ BEGIN TRANSACTION      │
  │                         ├─ Lock stock (FOR UPDATE)>│
  │                         ├─ Check availability     │
  │                         ├─ Decrement stock ───────>│
  │                         ├─ Create order ──────────>│
  │                         ├─ Clear cart ────────────>│
  │                         ├─ COMMIT TRANSACTION     │
  │                         ├─ Send confirmation email│
  │                         ├─ Notify admin           │
  │<─ 201 Created ──────────┤                          │
```

### 3. Admin Order Management

```
Client                    Backend                   Database
  │                         │                          │
  ├─ GET /api/admin/orders?since=timestamp ───────────>│
  │  (Admin JWT)            │                          │
  │                         ├─ Verify JWT & role      │
  │                         ├─ Query new orders ──────>│
  │                         │<─ Orders data ───────────┤
  │<─ 200 OK + Orders ──────┤                          │
  │                         │                          │
  ├─ PUT /api/admin/orders/:id/status ────────────────>│
  │  { status: "shipped" }  │                          │
  │                         ├─ Verify JWT & role      │
  │                         ├─ Validate transition    │
  │                         ├─ Update order ──────────>│
  │                         │<─ Order updated ─────────┤
  │                         ├─ Send notification      │
  │<─ 200 OK ───────────────┤                          │
```

## 🚀 Deployment Strategy

### Development
```bash
# Local development with Docker
docker-compose up -d
npm run dev
```

### Production (Oracle Cloud VPS)
```bash
# 1. Setup VPS
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql-16

# 2. Clone & build
git clone https://github.com/yourusername/savisanju-backend.git
cd savisanju-backend
npm install
npm run build

# 3. Configure environment
cp .env.example .env
nano .env  # Edit with production values

# 4. Run migrations
npm run migrate

# 5. Start with PM2
npm install -g pm2
pm2 start dist/server.js --name savisanju-api
pm2 startup
pm2 save

# 6. Setup Nginx reverse proxy
sudo apt install nginx
# Configure /etc/nginx/sites-available/savisanju-api

# 7. SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.savisanju.com
```

## 📊 Monitoring & Logging

### Health Checks
- `GET /health` - Server health status
- Database connection status
- Uptime and environment info

### Logging
- Request logging (method, path, status, duration)
- Error logging with stack traces (development only)
- Database query logging

### PM2 Monitoring
```bash
pm2 monit              # Real-time monitoring
pm2 logs savisanju-api # View logs
pm2 status             # Process status
```

## 🔧 Configuration

### Environment Variables
See `.env.example` for all required variables.

### CORS Configuration
```typescript
cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
})
```

### Rate Limiting
- Default: 100 requests per 15 minutes
- Auth endpoints: 5 attempts per 15 minutes
- Configurable via environment variables

## 📈 Scalability Considerations

### Horizontal Scaling
- Stateless API (JWT tokens)
- Redis for shared rate limiting
- Database connection pooling
- Load balancer ready

### Performance Optimization
- Database indexes on frequently queried columns
- Connection pooling (max 20 connections)
- Efficient SQL queries with JOINs
- Caching strategy (Redis)

### Future Enhancements
- [ ] Redis caching for product catalog
- [ ] CDN for static assets
- [ ] Database read replicas
- [ ] Message queue for async tasks (Bull/BullMQ)
- [ ] Elasticsearch for product search
- [ ] GraphQL API (optional)

## 🧪 Testing Strategy

### Unit Tests
- Utility functions (JWT, bcrypt, validation)
- Middleware (auth, rate limiting)

### Integration Tests
- API endpoints
- Database operations
- Authentication flow

### E2E Tests
- Complete user journeys
- Order placement flow
- Admin workflows

## 📝 API Documentation

### Swagger/OpenAPI
TODO: Add Swagger documentation

### Postman Collection
TODO: Export Postman collection

## 🤝 Contributing

1. Create feature branch from `main`
2. Follow TypeScript best practices
3. Write tests for new features
4. Update documentation
5. Submit pull request

## 📄 License

MIT License - See LICENSE file
