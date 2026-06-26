# Production deployment — Hetzner VPS via Docker Compose + GitHub Actions

CI/CD: push to `main` → GitHub Actions builds a Docker image, pushes it to GHCR,
SSHes into the Hetzner box and rolls the stack (Postgres + migrations + app +
Caddy). HTTPS is automatic via Caddy/Let's Encrypt.

Files: [`Dockerfile`](Dockerfile) · [`docker-compose.prod.yml`](docker-compose.prod.yml) ·
[`deploy/Caddyfile.prod`](deploy/Caddyfile.prod) · [`.env.production.example`](.env.production.example) ·
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) · DB migrations in `prisma/migrations/`.

Replace `panel.twojadomena.pl`, `OWNER/REPO`, and `CHANGE_ME…` placeholders.

---

## 1. Push the code to GitHub
The pipeline builds from the repo, so everything must be committed.
```bash
git add -A && git commit -m "Production setup"
gh repo create ochronazklasa-web --private --source=. --remote=origin --push
# or: git remote add origin git@github.com:OWNER/ochronazklasa-web.git && git push -u origin main
```
> The deploy workflow triggers on `main` (and `master`).

## 2. Create the server (Hetzner Cloud)
- **Add Server** → **Ubuntu 24.04**, **CX22** (2 vCPU/4 GB), an **EU** region, add your SSH key, enable Backups. Note the IPv4.
- **DNS:** point an A record `panel.twojadomena.pl → <server IP>`.

## 3. Provision the server (one-time)
SSH in as root, then:
```bash
# Non-root deploy user
adduser ochrona && usermod -aG sudo ochrona
rsync --archive --chown=ochrona:ochrona ~/.ssh /home/ochrona

# Firewall
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Docker + compose plugin
curl -fsSL https://get.docker.com | sh
usermod -aG docker ochrona
```
Reconnect as `ochrona` (`ssh ochrona@<ip>`) for the rest.

## 4. Lay down the stack files
```bash
sudo mkdir -p /opt/ochrona && sudo chown ochrona:ochrona /opt/ochrona
cd /opt/ochrona
# Get the two infra files onto the box (clone is simplest; only these are used):
git clone https://github.com/OWNER/ochronazklasa-web.git repo
cp repo/docker-compose.prod.yml .
cp repo/deploy/Caddyfile.prod ./Caddyfile
sed -i 's/panel.twojadomena.pl/YOUR_DOMAIN/' Caddyfile
```

## 5. Create the server `.env`
```bash
cp repo/.env.production.example /opt/ochrona/.env
nano /opt/ochrona/.env
```
Fill in (all in `/opt/ochrona/.env`):
- `POSTGRES_PASSWORD` — a long random string; mirror it inside `DATABASE_URL`.
- `AUTH_SECRET` — `openssl rand -base64 32`.
- `APP_URL` / `AUTH_URL` — `https://YOUR_DOMAIN`.
- `APP_IMAGE` — leave as is; the pipeline overwrites it each deploy.
- `chmod 600 /opt/ochrona/.env`

## 6. GitHub secrets (repo → Settings → Secrets → Actions)
| Secret | Value |
|--------|-------|
| `SSH_HOST` | server IPv4 |
| `SSH_USER` | `ochrona` |
| `SSH_KEY` | the **private** SSH key that matches the server's authorized key |
| `GHCR_PAT` | a GitHub **PAT (classic)** with `read:packages` — the server uses it to pull the image |

The build job pushes to GHCR using the built-in `GITHUB_TOKEN` (no secret needed).
First push may create a **private** package — that's why the server needs `GHCR_PAT`
(or make the package public under repo → Packages, then `GHCR_PAT` can be any value).

## 7. First deploy
Push to `main` (or run the **Deploy to Hetzner** workflow manually). It will:
build the image → push to GHCR → SSH in → `prisma migrate deploy` → start the stack.
Watch progress in the repo's **Actions** tab, then open `https://YOUR_DOMAIN`
(Caddy fetches the TLS cert on first hit).

## 8. Seed production data (fresh DB)
From `/opt/ochrona` on the server:
```bash
DC="docker compose -f docker-compose.prod.yml"

# First admin login
$DC run --rm app node scripts/create-admin.mjs you@firma.pl "StrongPass123" "Imię"

# 28k school directory (copy the XLSX to the server first, e.g. /opt/ochrona/schools.xlsx)
$DC run --rm -v /opt/ochrona/schools.xlsx:/tmp/s.xlsx app node scripts/import-schools.mjs /tmp/s.xlsx
```
- **Bank accounts:** upload the `Stan druków` XLSX in the app under **Ustawienia → Wgraj plik**.
- **Agents:** add them under **Agenci**.

## 9. Day-to-day
- **Deploy:** just `git push` to `main` — the pipeline does the rest (migrations included).
- **Logs:** `docker compose -f docker-compose.prod.yml logs -f app`
- **Rollback:** on the server, set `APP_IMAGE=ghcr.io/OWNER/REPO:<old-sha>` in `.env`,
  then `docker compose -f docker-compose.prod.yml up -d`.
- **DB backup (cron, daily):**
  ```bash
  docker compose -f /opt/ochrona/docker-compose.prod.yml exec -T db \
    pg_dump -U ochrona ochronazklasa | gzip > /opt/ochrona/backup_$(date +%F).sql.gz
  ```
  Keep Hetzner VM backups on too. Restore: `gunzip -c backup.sql.gz | docker compose … exec -T db psql -U ochrona ochronazklasa`.

## Migrations
The schema is versioned in `prisma/migrations/`. Each deploy runs
`prisma migrate deploy` (the `migrate` service) before the app starts. To add a
change: edit `prisma/schema.prisma`, run `npm run db:migrate -- --name <change>`
locally to create the migration, commit it, and push.

## Notes
- Postgres is **not** published to the host — only the app reaches it on the
  compose network. Only 22/80/443 are open (ufw).
- `next start` runs in the image; templates (docx/flyers) are baked in, so no
  external file setup is needed.
- The older systemd/host approach in `deploy/ochrona.service` + `deploy/Caddyfile`
  is **superseded** by this Docker Compose flow.
