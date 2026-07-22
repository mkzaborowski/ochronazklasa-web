# Service inventory

Current stacks on the server, one section each. Verify live state anytime with
`srv status`.

## /opt/caddy — shared reverse proxy

- **Image:** `caddy:2` (official). The only container binding host ports
  (80/443).
- **Files:** `Caddyfile` (routes), `docker-compose.yml`.
- **Networks:** `edge` (to reach the apps) — this membership is mandatory;
  without it every route 502s.
- **TLS:** automatic Let's Encrypt per site block; certs live in a volume, so
  container recreation does not re-issue.
- **Change procedure:** edit `Caddyfile` → `srv caddy-reload` (validates first,
  reload is zero-downtime). Back up the file before edits (the nightly
  `srv backup` also snapshots it).

Current routes (keep in sync when editing):

| Domain | Upstream | Stack |
|---|---|---|
| panel/web domain (see Caddyfile) | `app:3000` | /opt/ochrona |
| `api.ochronazklasa.pl` | `ozk-api:4000` | /opt/ozk-api |

## /opt/ochrona — ochronazklasa-web (Next.js panel + Postgres)

- **Repo:** `mkzaborowski/ochronazklasa-web`; image `ghcr.io/mkzaborowski/ochronazklasa-web`.
- **Files:** `docker-compose.prod.yml`, `.env` (holds `APP_IMAGE` pinned by CI,
  DB credentials, app secrets), `backups/`.
- **Services:** `app` (Next.js, :3000) and `db` (Postgres 16, volume
  `pgdata`-style, reachable only inside this stack).
- **Deploy:** push to `main` → GH Actions builds, SSHes in, pins `APP_IMAGE` to
  the commit SHA, `compose pull && up -d`.
- **Backup:** `pg_dump` — automated inside `srv backup`
  (`ochrona-db.sql.gz`).

## /opt/ozk-api — EDU Plus purchase API

- **Repo:** `mkzaborowski/ochronazklasa-api`; image
  `ghcr.io/mkzaborowski/ochronazklasa-api` (**private** package — server must
  be `docker login`-ed to GHCR with a `read:packages` PAT).
- **What it does:** accepts insurance applications from the static site's
  wizard, re-validates server-side (PESEL, date window, consents, premium),
  takes payment (Przelewy24; `mock` mode until credentials arrive), generates
  the certificate PDF from the InterRisk template and e-mails it, numbers
  certificates `OZK/IND/<year>/00001`.
- **Files:** `docker-compose.yml`, `.env` (see repo `.env.example`; key values:
  `FRONTEND_ORIGIN`, `PUBLIC_BASE_URL`, `PAYMENTS_MODE`, `ADMIN_TOKEN`,
  SMTP + P24 credentials when live).
- **State:** SQLite on the named volume `ozk_api_data` (`/app/data`) — holds
  paid applications and the certificate counter. **Never `compose down -v`**
  without a fresh backup; losing it resets certificate numbering.
- **Endpoints:** `GET /api/health` (monitoring), `POST /api/applications`,
  `GET /api/applications/:id`, `POST /api/payments/p24/status` (webhook),
  `GET /api/admin/wnioski.csv` (office export; header
  `Authorization: Bearer $ADMIN_TOKEN`).
- **Deploy:** push to `main` of `ochronazklasa-api` → same SHA-pinning pattern
  (`API_IMAGE` in `.env`).
- **Backup:** consistent online SQLite copy — automated inside `srv backup`
  (`ozk-api-wnioski.sqlite`).
- **Gotcha:** while `PAYMENTS_MODE=mock`, visiting the mock-pay URL "completes"
  a purchase without money — do not point the production site at it outside of
  testing.

## /opt/ozk-www — static marketing site (ochronazklasa.pl)

- **Repo:** `mkzaborowski/ochronazklasa` (Vite SPA). No image of its own — a
  plain `caddy:2` container serves files from a bind-mounted `dist/`.
- **Files:** `docker-compose.yml`, `Caddyfile-static` (SPA fallback
  `try_files {path} /index.html`, immutable caching for `/assets/*`), `dist/`.
- **Deploy:** push to `main` → GH Actions builds with
  `VITE_API_BASE_URL=https://api.ochronazklasa.pl` and
  `VITE_PURCHASE_ENABLED` (launch gate) → scp to `dist-new` → **rsync contents
  into `dist/`** → post-deploy HTTP check.
- **Gotcha (learned the hard way):** never replace `dist/` with `mv` — it is a
  bind mount, so the container keeps the old inode and serves 404s. Always
  sync contents in place (the workflow does). If it ever happens:
  `cd /opt/ozk-www && docker compose up -d --force-recreate`.
- **History:** replaced the old shared-hosting scp deploy, which had been
  failing with i/o timeouts since ~May 2026.

## Not services (do not touch)

- `/opt/containerd` — Docker's own runtime directory, not a stack.
- `/opt/backups` — written by `srv backup`, pruned automatically (14 kept).
