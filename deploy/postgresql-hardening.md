# PostgreSQL Hardening — SaviSanju Collections

Target: single bare-metal host (1 vCPU / 2 GB RAM), Postgres installed natively,
API on the same machine connecting over `localhost`.

> **The single most important step:** make the app connect as the least-privilege
> role **`savisanju_app`** (created in migration `009`). Connecting as the
> superuser `postgres` **bypasses Row Level Security**, so the RLS policies in
> migrations 009/010 only actually enforce when `DB_USER=savisanju_app`.

---

## 1. Bind to localhost only

`postgresql.conf`:
```conf
listen_addresses = 'localhost'
max_connections = 50            # plenty for one 2 GB app instance; keep > DB_POOL_MAX
password_encryption = scram-sha-256
```

## 2. Restrict authentication (`pg_hba.conf`)

Allow only local, password-authenticated connections. Example:
```conf
# TYPE  DATABASE    USER            ADDRESS         METHOD
local   all         postgres                        peer
host    savisanju   savisanju_app   127.0.0.1/32    scram-sha-256
host    savisanju   savisanju_app   ::1/128         scram-sha-256
```
Remove/avoid any `trust` lines and any non-localhost `host` entries.

Reload after edits:
```bash
sudo systemctl reload postgresql
```

## 3. Create the application role and set its password

The role itself is created by migration `009` (as `NOLOGIN`). Enable login and set
a strong password, then grant DB connect:
```bash
sudo -u postgres psql -d savisanju -c \
  "ALTER ROLE savisanju_app WITH LOGIN PASSWORD '<strong-random-password>';"
sudo -u postgres psql -c "GRANT CONNECT ON DATABASE savisanju TO savisanju_app;"
```
Point the API at it (in `/etc/savisanju/api.env`):
```
DB_USER=savisanju_app
DB_PASSWORD=<the same strong password>
```

## 4. Apply migrations as the owner (superuser), run the app as `savisanju_app`

Migrations create tables/policies/grants and should be run by `postgres` (or the
DB owner). The running application then connects as `savisanju_app` so RLS is
enforced. See `migrations/README.md` for the apply loop.

## 5. Verify RLS is actually enforcing

Connect as `savisanju_app` and confirm a user cannot read another user's rows
without the session context set:
```sql
-- As savisanju_app, with no app.current_user_id set, this should return 0 rows:
SELECT count(*) FROM cart_items;
SELECT count(*) FROM orders;
SELECT count(*) FROM admin_audit_log;   -- requires app.is_admin = 'on'
```
(The backend sets `app.current_user_id` / `app.is_admin` per request via
`queryAsUser`.)

## 6. General hygiene

- Keep Postgres patched (`apt upgrade`).
- Daily logical backup, e.g. `pg_dump savisanju | gzip > /var/backups/savisanju-$(date +%F).sql.gz` via cron; keep off-box copies.
- Do not expose 5432 to the internet (firewall covers this — see SECURITY-DEPLOYMENT.md).
