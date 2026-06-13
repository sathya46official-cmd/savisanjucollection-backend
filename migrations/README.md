# Database Migrations

SQL migration files for the SaviSanju Collections database (self-hosted PostgreSQL).

> **Run them in numeric order.** The migrations are interdependent (later ones
> reference tables/functions created earlier — e.g. `009`/`010` rely on tables
> from `001`/`006` and the `app_is_admin()` helper from `009`). The
> `for file in migrations/*.sql` loop below runs them all in the correct order.

## Migration Files

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Core schema: `products`, `product_variants`, `user_profiles`, `user_auth`, `orders`, `stock_notifications` (with `UNIQUE(email, variant_id)`) |
| `002_security_architecture_overhaul.sql` | Security architecture changes (constraints, functions; legacy Supabase `auth.uid()` policies removed — superseded by `009`) |
| `003_allow_guest_orders.sql` | Allow guest orders (`orders.user_id` nullable) |
| `004_add_hex_codes_and_cleanup.sql` | Add `hex_code` to `product_variants` + cleanup |
| `005_email_verification.sql` | `email_verification_tokens` table |
| `006_cart_system.sql` | `cart_items` table (keyed by `user_id`) + its indexes |
| `007_stock_notifications.sql` | Stock notification request fields/indexes |
| `008_add_user_roles.sql` | Add trusted `user_profiles.role` column (authoritative for admin) |
| `009_fix_row_level_security.sql` | Correct, portable RLS on `cart_items`, `orders`, `stock_notifications`; creates least-privilege `savisanju_app` role |
| `010_admin_audit_log.sql` | `admin_audit_log` append-only table (admin-only RLS) |

## How to Run Migrations

Apply migrations as a privileged role (`postgres` or the DB owner). The running
**application** should connect as `savisanju_app` (see below), not `postgres`.

### Option 1 — Run all in order (recommended)

```bash
# Local psql. ON_ERROR_STOP=1 aborts on the first failure.
for file in migrations/*.sql; do
  echo "Running $file..."
  psql -v ON_ERROR_STOP=1 -U postgres -d savisanju -f "$file" || break
done
```

### Option 2 — Docker

```bash
docker ps | grep postgres   # find the container name
for file in migrations/*.sql; do
  echo "Running $file..."
  docker exec -i <container-name> psql -v ON_ERROR_STOP=1 -U postgres -d savisanju < "$file" || break
done
```

### Activate Row Level Security (important)

RLS (migrations `009`/`010`) only **enforces** when the app connects as the
non-superuser `savisanju_app` role — superusers bypass RLS. After migrating:

```bash
sudo -u postgres psql -d savisanju -c \
  "ALTER ROLE savisanju_app WITH LOGIN PASSWORD '<strong-password>';"
sudo -u postgres psql -c "GRANT CONNECT ON DATABASE savisanju TO savisanju_app;"
```
Then set `DB_USER=savisanju_app` / `DB_PASSWORD=...` in the app env.
See `deploy/postgresql-hardening.md`.

## Verify Migrations

```sql
psql -U postgres -d savisanju

\dt   -- expected tables:
--  - user_profiles        (includes the `role` column from 008, `email_verified`)
--  - user_auth
--  - products
--  - product_variants     (includes `hex_code`)
--  - orders               (user_id nullable for guest orders; RLS enabled)
--  - cart_items           (keyed by user_id; RLS enabled)
--  - email_verification_tokens
--  - stock_notifications  (RLS enabled; UNIQUE(email, variant_id))
--  - admin_audit_log      (admin-only RLS, append-only)
-- NOTE: there is NO `order_items` table — orders reference a variant directly.

-- RLS helpers / policies
\df app_current_user_id
\df app_is_admin
\d+ orders        -- shows policies cart_items/orders/etc.
```

## Rollback (destructive — dev only)

Drop in reverse dependency order. Only do this to fully reset a dev database:

```sql
DROP TABLE IF EXISTS admin_audit_log CASCADE;          -- 010
DROP TABLE IF EXISTS stock_notifications CASCADE;      -- 001/007
DROP TABLE IF EXISTS cart_items CASCADE;               -- 006
DROP TABLE IF EXISTS email_verification_tokens CASCADE;-- 005
DROP TABLE IF EXISTS orders CASCADE;                   -- 001/003
DROP TABLE IF EXISTS product_variants CASCADE;         -- 001
DROP TABLE IF EXISTS products CASCADE;                 -- 001
DROP TABLE IF EXISTS user_auth CASCADE;                -- 001
DROP TABLE IF EXISTS user_profiles CASCADE;            -- 001
DROP FUNCTION IF EXISTS app_current_user_id();         -- 009
DROP FUNCTION IF EXISTS app_is_admin();                -- 009
-- The savisanju_app role is shared infra; drop only if truly resetting:
-- DROP OWNED BY savisanju_app; DROP ROLE IF EXISTS savisanju_app;
```

## Migration Best Practices

1. **Backup before running migrations in production** (`pg_dump`).
2. **Test in development first.**
3. **Run in numeric order** (the loop handles this).
4. **Keep applied migration files immutable.**
5. **Document any manual data changes** (e.g. the email-verification grandfather
   `UPDATE` in `deploy/SECURITY-DEPLOYMENT.md`).
