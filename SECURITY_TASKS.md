# Security Hardening — Work Log & Remaining Tasks

Branch: `security/vulnerability-fixes` (NOT yet merged to `main` — user will merge manually).
Remote: github.com/sathya46official-cmd/savisanjucollection-backend
Target host: bare-metal **1 vCPU / 2 GB RAM**, PostgreSQL + Redis installed natively, Docker available.

---

## ✅ DONE (already committed & pushed to `security/vulnerability-fixes`)

Commits:
- `bb16074` — 6 original vulns (privilege escalation, DoS/proxy trap, inventory race, pricing, RLS, hardcoded creds)
- `a8f7366` — removed Supabase remnants + fixed migrations for self-hosted Postgres/Docker
- `6a945a8` — 007 audit hardening (verification token, DB password fail-fast, upload ext, Dockerfile build)

Details of what changed:
1. **Privilege escalation** — migration `008_add_user_roles.sql` adds trusted `role` column; `auth.controller.ts` admin check uses DB role only (no email shortcut).
2. **Hardcoded creds** — removed seeded admin from `001`; added `scripts/create-admin.ts` (env-driven, bcrypt, sets `email_verified=TRUE`, `role=admin`).
3. **DoS/Nginx proxy trap** — `server.ts` sets numeric `trust proxy` (`TRUST_PROXY_HOPS`, default 1 prod / 0 dev) + mounts global rate limiter on `/api`.
4. **Inventory race** — `order.routes.ts` `/create` uses transaction + `SELECT ... FOR UPDATE` + guarded atomic stock decrement + proper returns.
5. **Pricing** — `product.routes.ts` variant create/update: deterministic `Math.round(price*100)` (rupees→paise), removed `>1000` heuristic.
6. **RLS** — migration `009_fix_row_level_security.sql` (portable GUC-based policies on cart_items/orders/stock_notifications, FORCE RLS, least-priv `savisanju_app` role). `config/database.ts` `queryAsUser()` helper; wired into cart/order/admin queries. VERIFIED isolation works under `savisanju_app` role on a Docker Postgres test.
7. **Supabase removal** — deleted `auth.uid()` policies from `002`; fixed invalid single-`$` → `$$` dollar-quoting in `002`; removed duplicate legacy `cart`/`cart_items(cart_id)` from `001` so `006`'s `cart_items(user_id)` is authoritative; moved cart_items indexes to `006`; added `UNIQUE(email,variant_id)` to stock_notifications in `001`. VERIFIED: migrations 001→009 apply cleanly on postgres:16-alpine.
8. **Email verification token** — `auth.controller.ts` register now generates a random 32-byte token, stores it in `email_verification_tokens` with 24h expiry; `services/email.ts` `sendVerificationEmail(email, token)` uses it (was using `userId` as token = predictable + internal-ID leak + broken flow).
9. **DB password** — `config/database.ts` fail-fast in prod if `DB_PASSWORD` unset; pool max via `DB_POOL_MAX` (default 10, tuned for 2GB).
10. **Uploads** — `admin.routes.ts` multer derives extension from validated MIME type (not user filename) to prevent stored `.svg/.html/.php` XSS/RCE.
11. **Dockerfile** — builder stage now runs `npm ci` (was `--only=production`, so `tsc` was missing and build failed).

Current audit score: **≈81/100 — Approved with reservations.**

---

## ⏳ REMAINING TASKS (do these next, then commit + push to same branch)

### Task 1 — Enforce email verification at login + resend endpoint
- File: `src/controllers/auth.controller.ts`
  - In `login`: add `up.email_verified` to the SELECT; if `!user.email_verified` → `res.status(403).json({ error: 'Please verify your email before logging in.', code: 'EMAIL_NOT_VERIFIED' })`.
  - In `adminLogin`: same SELECT already has fields; admins from `create-admin.ts` are `email_verified=TRUE`, so safe — optionally also require it.
- New endpoint: `POST /api/auth/resend-verification` in `src/routes/auth.routes.ts` (use `authRateLimiter`):
  - Body `{ email }`. Look up user; if found & not verified: delete old tokens for that user, insert a new random token (24h), call `sendVerificationEmail`. ALWAYS return generic `200 {success:true, message:'If that email exists and is unverified, a link has been sent.'}` (no user enumeration).
  - Import `randomBytes` from crypto.
- ⚠️ BEHAVIOR-CHANGE WARNING: prior verification flow was broken, so existing non-admin users are `email_verified=false` and will be LOCKED OUT. Mitigations to mention to user:
  - They can self-recover via the new resend endpoint, OR
  - Grandfather existing users (only if they trust them):
    `UPDATE user_profiles SET email_verified = true WHERE created_at < NOW();`  (do NOT auto-run)

### Task 2 — Admin audit trail
- New migration `migrations/010_admin_audit_log.sql`:
  - Table `admin_audit_log(id uuid pk default gen_random_uuid(), actor_user_id uuid, actor_email text, action text not null, target_type text, target_id text, metadata jsonb, ip inet, created_at timestamptz default now())`.
  - Index on `(created_at desc)` and `(actor_user_id)`.
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; FORCE ...;` with policies: SELECT/INSERT only when `app_is_admin()` (helpers from 009 exist).
  - `GRANT SELECT, INSERT ON admin_audit_log TO savisanju_app;`
- New file `src/utils/audit.ts`: `export async function logAdminAction(actor, action, opts)` — best-effort insert via `queryAsUser(actor.userId, INSERT..., params, {isAdmin:true})`; wrap in try/catch (never block the main request); never throw.
- Wire calls (best-effort, after the action succeeds):
  - `admin.routes.ts`: stock update (`PUT /stock/:variantId`), order status update (`PUT /orders/:orderId/status`).
  - `product.routes.ts`: product create/update/delete, variant create/update/delete.
- Pass `req.user` + `req.ip`.

### Task 3 — Reduce PII in logs
- File: `src/services/email.ts` — the 4 `console.log("✅ ... ${email}")` lines leak recipient emails to stdout. Replace with non-PII messages, e.g. `console.log('✅ Verification email sent')` / log only the order id (not email). Keep error logs but avoid dumping email addresses.

### Task 4 — Deployment hardening configs (create `deploy/` dir)
- `deploy/nginx.conf` — HTTPS reverse proxy to `localhost:5000`; `client_max_body_size 6m` (uploads are 5MB×4); security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy); proxy headers (X-Forwarded-For/Proto) consistent with `TRUST_PROXY_HOPS=1`; rate-limit zone optional.
- `deploy/savisanju-api.service` — systemd unit: non-root user, `EnvironmentFile=/etc/savisanju/api.env`, `NODE_ENV=production`, `WorkingDirectory`, `ExecStart=/usr/bin/node dist/server.js`, `Restart=always`, hardening (`NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`, `MemoryMax=512M` for 2GB box).
- `deploy/postgresql-hardening.md` — `listen_addresses='localhost'`, `scram-sha-256`, restrict `pg_hba.conf`, `max_connections≈50`, create the **`savisanju_app`** login role + password and point `DB_USER/DB_PASSWORD` at it (THIS ACTIVATES RLS — currently bypassed under superuser `postgres`).
- `deploy/redis-hardening.md` — `bind 127.0.0.1`, `requirepass`, `protected-mode yes`, disable dangerous commands. (NOTE: Redis is installed but NOT wired into the app — `initRedis()` is never called; rate limiting is in-memory, fine for single instance.)
- `deploy/.env.production.example` — production env template (NODE_ENV=production, real DB_USER=savisanju_app, TRUST_PROXY_HOPS=1, JWT_SECRET/COOKIE_SECRET generation notes, RESEND_*, FRONTEND_URL, API_URL).
- `deploy/SECURITY-DEPLOYMENT.md` — checklist: ufw (22/80/443), fail2ban, SSH keys only, add ~2GB swap, certbot TLS, run create-admin.ts, activate savisanju_app role, set NODE_ENV=production, verify RLS active.

### Task 5 — Fix stale `migrations/README.md`
- The table lists wrong names (e.g. "002_add_featured_products.sql") and a nonexistent `order_items` table. Update to actual files: 001_initial_schema, 002_security_architecture_overhaul, 003_allow_guest_orders, 004_add_hex_codes_and_cleanup, 005_email_verification, 006_cart_system, 007_stock_notifications, 008_add_user_roles, 009_fix_row_level_security, 010_admin_audit_log. Fix the "expected tables" list (no order_items; cart_items keyed by user_id; add user_profiles.role). Note the `for file in migrations/*.sql` loop runs all in order.

### NOT doing (documented decision)
- **CSRF tokens**: NOT enforcing — would break the existing Vercel frontend (it doesn't send a CSRF token), and `sameSite=lax` cookies + CORS allowlist already mitigate. ALSO FLAG: if frontend (Vercel) and API are on different domains, `sameSite=lax` cookies won't be sent on cross-site `fetch` — confirm the auth flow (cookie same-site vs Bearer header). Document in SECURITY-DEPLOYMENT.md; do not change `sameSite` blindly.

---

## ✅ VERIFICATION CHECKLIST (run before final commit)
```bash
cd /home/sanju/savisanjucollection-backend
npm run build                                   # tsc must pass
npx vitest run src/__tests__/auth.test.ts       # must pass (email.test.ts fails pre-existing: no RESEND key)
# Full migration chain on throwaway Postgres:
docker rm -f savisanju_test 2>/dev/null
docker run -d --name savisanju_test -e POSTGRES_PASSWORD=password -e POSTGRES_DB=savisanju postgres:16-alpine
# wait for pg_isready, then apply migrations/0*.sql in order with ON_ERROR_STOP=1
docker rm -f savisanju_test
```
Then: `git add <files> && git commit && git push` (branch `security/vulnerability-fixes`).

## NOTES / GOTCHAS
- `email.test.ts` has 7 PRE-EXISTING failures (hits real Resend API, no key) — unrelated to our changes. `auth.test.ts` is the relevant one.
- RLS only ENFORCES when app connects as non-superuser `savisanju_app`; under `postgres` it's bypassed (app-layer checks still protect). This is by design / documented.
- `package.json` `migrate` script points to nonexistent `src/scripts/migrate.js` (minor; not fixed).
- docker-compose has dev-only `POSTGRES_PASSWORD: password` (dev only; user deploys bare-metal).
- App auth middleware accepts BOTH cookie `auth_token` and `Authorization: Bearer` header.
