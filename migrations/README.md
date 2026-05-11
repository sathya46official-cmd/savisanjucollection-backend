# Database Migrations

This directory contains SQL migration files for the SaviSanju Collections database schema.

## Migration Files

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Initial database schema (products, variants, orders, users) |
| `002_add_featured_products.sql` | Add featured flag and display_order columns |
| `003_add_hex_codes.sql` | Add hex_code column to product_variants |
| `004_add_hex_codes_and_cleanup.sql` | Update hex codes for existing variants |
| `005_email_verification.sql` | Email verification tokens table |
| `006_cart_system.sql` | Shopping cart items table |
| `007_stock_notifications.sql` | Stock notification requests table |

## How to Run Migrations

### Option 1: Using psql directly

```bash
# Connect to your database and run each migration in order
psql -U postgres -d savisanju -f migrations/001_initial_schema.sql
psql -U postgres -d savisanju -f migrations/002_add_featured_products.sql
psql -U postgres -d savisanju -f migrations/003_add_hex_codes.sql
psql -U postgres -d savisanju -f migrations/004_add_hex_codes_and_cleanup.sql
psql -U postgres -d savisanju -f migrations/005_email_verification.sql
psql -U postgres -d savisanju -f migrations/006_cart_system.sql
psql -U postgres -d savisanju -f migrations/007_stock_notifications.sql
```

### Option 2: Using Docker

If your PostgreSQL is running in a Docker container:

```bash
# Find your container name
docker ps | grep postgres

# Run migrations (replace <container-name> with your actual container name)
docker exec -i <container-name> psql -U postgres -d savisanju < migrations/001_initial_schema.sql
docker exec -i <container-name> psql -U postgres -d savisanju < migrations/002_add_featured_products.sql
docker exec -i <container-name> psql -U postgres -d savisanju < migrations/003_add_hex_codes.sql
docker exec -i <container-name> psql -U postgres -d savisanju < migrations/004_add_hex_codes_and_cleanup.sql
docker exec -i <container-name> psql -U postgres -d savisanju < migrations/005_email_verification.sql
docker exec -i <container-name> psql -U postgres -d savisanju < migrations/006_cart_system.sql
docker exec -i <container-name> psql -U postgres -d savisanju < migrations/007_stock_notifications.sql
```

### Option 3: Run all migrations at once

```bash
# Using psql
for file in migrations/*.sql; do
  echo "Running $file..."
  psql -U postgres -d savisanju -f "$file"
done

# Using Docker
for file in migrations/*.sql; do
  echo "Running $file..."
  docker exec -i <container-name> psql -U postgres -d savisanju < "$file"
done
```

## Verify Migrations

After running migrations, verify that all tables and indexes were created successfully:

```sql
-- Connect to database
psql -U postgres -d savisanju

-- Check all tables exist
\dt

-- Expected tables:
-- - user_profiles
-- - products
-- - product_variants
-- - orders
-- - order_items
-- - email_verification_tokens
-- - cart_items
-- - stock_notifications

-- Check specific tables
\d email_verification_tokens
\d cart_items
\d stock_notifications

-- Check indexes
\di

-- Expected indexes:
-- - idx_verification_token
-- - idx_verification_user
-- - idx_cart_user
-- - idx_stock_notify_variant

-- Verify data integrity
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM product_variants;
SELECT COUNT(*) FROM user_profiles;
```

## Rollback (if needed)

If you need to rollback migrations, you can drop the tables in reverse order:

```sql
-- Drop new tables (migrations 005-007)
DROP TABLE IF EXISTS stock_notifications CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS email_verification_tokens CASCADE;

-- Note: Only drop these if you want to completely reset the database
-- DROP TABLE IF EXISTS order_items CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
-- DROP TABLE IF EXISTS product_variants CASCADE;
-- DROP TABLE IF EXISTS products CASCADE;
-- DROP TABLE IF EXISTS user_profiles CASCADE;
```

## Production Deployment

When deploying to production (Oracle VPS):

1. **Backup existing database** (if any):
   ```bash
   pg_dump -U postgres savisanju > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Run migrations**:
   ```bash
   cd /path/to/savisanju-backend
   for file in migrations/*.sql; do
     echo "Running $file..."
     psql -U savisanju_user -d savisanju -f "$file"
   done
   ```

3. **Verify migrations**:
   ```bash
   psql -U savisanju_user -d savisanju -c "\dt"
   psql -U savisanju_user -d savisanju -c "\di"
   ```

4. **Test application**:
   - Start backend: `pm2 start dist/server.js --name savisanju-backend`
   - Check logs: `pm2 logs savisanju-backend`
   - Test API endpoints

## Troubleshooting

### Error: "relation already exists"

This means the table was already created. You can either:
- Skip the migration (it's already applied)
- Drop the table and re-run: `DROP TABLE IF EXISTS <table_name> CASCADE;`

### Error: "permission denied"

Make sure your database user has the correct permissions:
```sql
GRANT ALL PRIVILEGES ON DATABASE savisanju TO savisanju_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO savisanju_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO savisanju_user;
```

### Error: "database does not exist"

Create the database first:
```sql
CREATE DATABASE savisanju;
```

## Migration Best Practices

1. **Always backup before running migrations in production**
2. **Test migrations in development first**
3. **Run migrations in order** (001, 002, 003, etc.)
4. **Verify each migration** before proceeding to the next
5. **Keep migration files immutable** (never edit after deployment)
6. **Document any manual data changes** needed after migrations
