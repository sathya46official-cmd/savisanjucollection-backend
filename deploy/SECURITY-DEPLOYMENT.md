# Production Deployment & Security Checklist — SaviSanju Collections

Target host: bare-metal **1 vCPU / 2 GB RAM**, Ubuntu/Debian, PostgreSQL + Redis
installed natively, Docker available. API behind Nginx with TLS; frontend on Vercel.

Work top-to-bottom. Items marked **(security-critical)** must not be skipped.

---

## 1. Host baseline

- [ ] Create a non-root user `savisanju`; deploy the app under `/opt/savisanju/`.
- [ ] **(security-critical)** SSH: key-based auth only — set `PasswordAuthentication no` and `PermitRootLogin no` in `/etc/ssh/sshd_config`, then `systemctl reload ssh`.
- [ ] **(security-critical)** Firewall (ufw): allow only 22, 80, 443.
  ```bash
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
  sudo ufw enable
  ```
  This also keeps Postgres (5432) and Redis (6379) off the public internet.
- [ ] Install fail2ban (sshd jail) to throttle brute-force SSH.
- [ ] Add ~2 GB swap (the box only has 2 GB RAM; builds/Postgres benefit):
  ```bash
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```
- [ ] Keep the OS patched: `sudo apt update && sudo apt upgrade -y`.

## 2. Database (PostgreSQL)

- [ ] Follow **`deploy/postgresql-hardening.md`** in full.
- [ ] Create the DB and apply migrations `001` → `010` in order (see `migrations/README.md`).
- [ ] **(security-critical)** Create the `savisanju_app` login role + strong password and set `DB_USER=savisanju_app` / `DB_PASSWORD=...`. **This activates RLS** — under `postgres` it is bypassed.
- [ ] Verify RLS enforcement (section 5 of the Postgres guide).
- [ ] Set up a daily `pg_dump` backup cron with off-box copies.

## 3. Redis

- [ ] Follow **`deploy/redis-hardening.md`**. Redis is not wired into the app today, so the simplest safe choice is `systemctl disable --now redis-server`. If kept, bind to loopback + `requirepass`.

## 4. Application

- [ ] `npm ci && npm run build` in the deploy directory.
- [ ] Copy `deploy/.env.production.example` → `/etc/savisanju/api.env`, fill in real secrets, `chmod 600`.
  - [ ] **(security-critical)** Generate fresh `JWT_SECRET` and `COOKIE_SECRET` (64-byte hex each). The app refuses to start in production without them.
  - [ ] Set `NODE_ENV=production`, `TRUST_PROXY_HOPS=1`, real `FRONTEND_URL` (your Vercel domain) and `API_URL`.
  - [ ] Set `RESEND_API_KEY` + verified `RESEND_FROM_EMAIL` so verification/order emails actually send.
- [ ] **(security-critical)** Create the admin account (no admin is seeded by migrations):
  ```bash
  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong>' npx tsx scripts/create-admin.ts
  ```
  This sets `role=admin` and `email_verified=TRUE` for that account.
- [ ] Install + start the service: `deploy/savisanju-api.service` (see header comments).
- [ ] `curl -f http://127.0.0.1:5000/health` returns ok.

## 5. Nginx + TLS

- [ ] Install `deploy/nginx.conf` (edit `server_name` to your API hostname).
- [ ] Obtain TLS cert: `sudo certbot --nginx -d api.savisanju.com` (certbot auto-renews).
- [ ] `nginx -t && systemctl reload nginx`; confirm `https://api.savisanju.com/health`.
- [ ] Only enable the HSTS header (already in the config) once HTTPS is confirmed.

## 6. Existing-user impact — EMAIL VERIFICATION (read before go-live)

Login now **rejects unverified accounts** (403 `EMAIL_NOT_VERIFIED`). The previous
verification flow was broken, so pre-existing **non-admin** users are
`email_verified = false` and will be **locked out**. Choose one:

- **Self-recovery (recommended):** point users at the new
  `POST /api/auth/resend-verification` endpoint (body `{ "email": "..." }`); it
  always returns a generic 200 and re-sends a link to genuinely unverified users.
- **Grandfather existing users (only if you trust them all):** run ONCE, manually
  — never auto-run:
  ```sql
  UPDATE user_profiles SET email_verified = true WHERE created_at < NOW();
  ```
- Admins created via `create-admin.ts` are already verified — unaffected.

## 7. CSRF & cross-site cookies — DECISION + ACTION REQUIRED

We intentionally **do not enforce CSRF tokens**: the Vercel frontend doesn't send
one, and `sameSite=lax` cookies + the CORS allowlist already mitigate CSRF for
same-site usage. **However**, there is a deployment-shape gotcha to confirm:

> The auth cookie is `sameSite=lax`. If the frontend (e.g. `*.vercel.app`) and the
> API (`api.savisanju.com`) are on **different sites**, the browser will **not**
> send the `lax` cookie on cross-site `fetch` calls — login would appear to
> "not stick".

Confirm your auth flow and pick one:
- **Bearer token (simplest cross-site):** frontend stores the returned token and
  sends `Authorization: Bearer <token>`. The auth middleware already accepts this,
  so no cookie cross-site issue. **Do not** loosen `sameSite` in this case.
- **Cross-site cookies:** if you must rely on cookies across sites, you'd need
  `sameSite=none; Secure` — but that re-opens CSRF and is **out of scope** here.
  Do **not** change `sameSite` blindly; revisit CSRF protection first.

Action: verify the frontend's actual auth mechanism (cookie vs Bearer) against the
deployed domain layout before launch.

## 8. Post-deploy verification

- [ ] Register → receive verification email → verify → login succeeds.
- [ ] Login with an unverified account → 403 `EMAIL_NOT_VERIFIED`.
- [ ] Admin login works; an admin action (e.g. stock update) appears in `admin_audit_log`.
- [ ] Rate limiting triggers under rapid repeated requests (per-IP, not global).
- [ ] Logs contain **no** recipient email addresses (PII) for sent emails.
- [ ] App process is non-root; Postgres/Redis not reachable from the public internet.
