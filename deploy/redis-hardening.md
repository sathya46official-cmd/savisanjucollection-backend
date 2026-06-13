# Redis Hardening — SaviSanju Collections

> **Status:** Redis is installed on the host but **NOT currently wired into the
> application** — `initRedis()` is never called, and rate limiting runs
> **in-memory** (which is correct and sufficient for this single-instance
> deployment). This guide applies if/when Redis is integrated, and hardens the
> installed daemon regardless so it isn't a stray attack surface.

If you are not using Redis, the safest option is to **stop and disable it**:
```bash
sudo systemctl disable --now redis-server
```

If you do keep it running, harden `redis.conf` (`/etc/redis/redis.conf`):

```conf
# Listen only on loopback — never expose Redis to the network.
bind 127.0.0.1 ::1
protected-mode yes
port 6379

# Require a strong password (clients must AUTH).
requirepass <strong-random-password>

# Disable / rename dangerous commands so a compromised client can't nuke data
# or pivot via Lua. Empty string fully disables a command.
rename-command FLUSHALL ""
rename-command FLUSHDB  ""
rename-command CONFIG   ""
rename-command DEBUG    ""
rename-command SHUTDOWN ""

# Keep memory bounded on a 2 GB box.
maxmemory 128mb
maxmemory-policy allkeys-lru
```

Then:
```bash
sudo systemctl restart redis-server
redis-cli -a '<password>' ping   # expect PONG
```

Also ensure the firewall blocks 6379 from the outside (see SECURITY-DEPLOYMENT.md);
binding to loopback already prevents remote access, but defense-in-depth is cheap.
