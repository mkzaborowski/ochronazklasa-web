# Maintenance — the `srv` tool, routines, backups & restore

## Installing / updating the tool

Source of truth: [`deploy/srv`](../../deploy/srv) in this repo.

```bash
scp deploy/srv root@167.233.204.214:/usr/local/bin/srv
ssh root@167.233.204.214 chmod +x /usr/local/bin/srv
```

It has no dependencies beyond docker + curl + openssl (all present) and
auto-discovers stacks and domains, so it survives adding/removing services
untouched.

## Commands

| Command | What it does |
|---|---|
| `srv status` | per-stack `compose ps`, container RAM/CPU, disk, RAM, `edge` members |
| `srv health` | HTTPS probe of every domain found in the Caddyfile |
| `srv certs` | TLS expiry per domain, warns under 14 days |
| `srv doctor` | everything above + unhealthy/restarting containers, disk threshold, backup freshness — **run this first when anything feels off** |
| `srv logs <stack> [n]` | last *n* log lines of a stack (default 100), e.g. `srv logs ozk-api 200` |
| `srv restart <stack>` | restart one stack |
| `srv update <stack\|all>` | `compose pull && up -d` + prune old images (`all` skips caddy) |
| `srv caddy-reload` | validate Caddyfile, then zero-downtime reload |
| `srv backup` | full backup, see below |

## Routine cadence

- **Nightly (automated)** — add once to root's crontab:
  ```
  0 3 * * * /usr/local/bin/srv backup >> /var/log/srv-backup.log 2>&1
  15 3 * * 1 /usr/local/bin/srv doctor >> /var/log/srv-doctor.log 2>&1
  ```
- **Weekly (1 min, manual)** — glance at `srv doctor` output; check
  `docker stats` headroom before adding anything new.
- **Monthly** — OS patching: `apt update && apt upgrade`, reboot if the kernel
  changed (~1 min downtime; Hetzner console is the fallback if SSH dies).
  Docker base images refresh themselves on every CI deploy.
- **Deploys are not maintenance** — they happen from GitHub Actions on push;
  the server needs no manual steps.

## What `srv backup` produces

`/opt/backups/<YYYY-MM-DD_HHMM>/` (14 most recent kept, older pruned):

| File | Content | Method |
|---|---|---|
| `ochrona-db.sql.gz` | panel's Postgres | `pg_dump` inside the db container (consistent) |
| `ozk-api-wnioski.sqlite` | applications + certificate counter | better-sqlite3 online `.backup()` (consistent even under writes) |
| `Caddyfile` | routing | copy |
| `env-<stack>`, `compose-<stack>.yml` | every stack's config | copy, `chmod go-rwx` |

Backups live **on the same disk** — for real disaster-resistance, sync the
directory off-box periodically (e.g. from your laptop:
`rsync -a root@167.233.204.214:/opt/backups/ ~/Backups/hetzner/`), or add a
Hetzner Storage Box later.

## Restore

**Postgres (ochrona):**

```bash
cd /opt/ochrona
gunzip -c /opt/backups/<DATE>/ochrona-db.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U ochrona -d ochronazklasa
```

**SQLite (ozk-api):** stop the API, replace the file inside the volume, start:

```bash
cd /opt/ozk-api
docker compose stop
docker compose cp /opt/backups/<DATE>/ozk-api-wnioski.sqlite ozk-api:/app/data/wnioski.sqlite 2>/dev/null || \
  docker run --rm -v ozk-api_ozk_api_data:/data -v /opt/backups/<DATE>:/b alpine cp /b/ozk-api-wnioski.sqlite /data/wnioski.sqlite
docker compose up -d
```

**Caddyfile:** `cp /opt/backups/<DATE>/Caddyfile /opt/caddy/Caddyfile && srv caddy-reload`.

**Whole app rollback (bad deploy):** set the previous image SHA in the stack's
`.env` (`APP_IMAGE=…:<old-sha>` / `API_IMAGE=…`) and `docker compose up -d` —
every CI deploy leaves SHA-tagged images on GHCR precisely for this.

## Capacity guardrails

8 GB RAM / 75 GB disk. Every service carries `mem_limit: 512m`; `srv doctor`
warns at 80 % disk. Rule of thumb: a Node/Go API + small DB ≈ 0.3–0.7 GB RAM.
If RAM pressure appears, resize in the Hetzner console (disk/IP survive, ~1 min
downtime).
