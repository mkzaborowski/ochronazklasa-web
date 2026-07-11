#!/usr/bin/env bash
# One-shot Hetzner bootstrap: installs Docker, writes the stack files, pulls the
# prebuilt GHCR image and starts DB + migrations + app + Caddy. Idempotent.
#
# Run as root on a fresh Ubuntu 24.04 box:
#   # (a) image made public -> no token needed:
#   GHCR_TOKEN= bash bootstrap-hetzner.sh
#   # (b) private image -> pass a GitHub token with read:packages:
#   GHCR_TOKEN=ghp_xxx bash bootstrap-hetzner.sh
#   # optional HTTPS (DNS A record must already point at this server):
#   DOMAIN=panel.twojadomena.pl GHCR_TOKEN=... bash bootstrap-hetzner.sh
set -euo pipefail

GHCR_USER="${GHCR_USER:-mkzaborowski}"
IMAGE="${IMAGE:-ghcr.io/mkzaborowski/ochronazklasa-web:latest}"
GHCR_TOKEN="${GHCR_TOKEN:-}"
DOMAIN="${DOMAIN:-}"
DIR=/opt/ochrona

echo "==> Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

echo "==> Firewall (22/80/443)"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 80 >/dev/null 2>&1 || true
ufw allow 443 >/dev/null 2>&1 || true
yes | ufw enable >/dev/null 2>&1 || true

mkdir -p "$DIR"; cd "$DIR"
PUBIP="${PUBIP:-$(curl -4 -s https://ifconfig.me || hostname -I | awk '{print $1}')}"
if [ -n "$DOMAIN" ]; then URL="https://$DOMAIN"; else URL="http://$PUBIP"; fi

echo "==> .env"
if [ ! -f .env ]; then
  DBPASS="$(openssl rand -hex 16)"
  SECRET="$(openssl rand -base64 32)"
  cat > .env <<EOF
APP_IMAGE=$IMAGE
POSTGRES_USER=ochrona
POSTGRES_PASSWORD=$DBPASS
POSTGRES_DB=ochronazklasa
NODE_ENV=production
DATABASE_URL=postgresql://ochrona:$DBPASS@db:5432/ochronazklasa?schema=public
APP_URL=$URL
AUTH_URL=$URL
AUTH_TRUST_HOST=true
AUTH_SECRET=$SECRET
EOF
  chmod 600 .env
fi

echo "==> Caddyfile ($URL)"
if [ -n "$DOMAIN" ]; then
  printf '%s {\n  encode zstd gzip\n  reverse_proxy app:3000\n}\n' "$DOMAIN" > Caddyfile
else
  printf ':80 {\n  encode zstd gzip\n  reverse_proxy app:3000\n}\n' > Caddyfile
fi

echo "==> docker-compose.prod.yml"
cat > docker-compose.prod.yml <<'YAML'
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 12
  migrate:
    image: ${APP_IMAGE}
    restart: "no"
    depends_on:
      db:
        condition: service_healthy
    env_file: .env
    command: ["npx", "prisma", "migrate", "deploy"]
  app:
    image: ${APP_IMAGE}
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    env_file: .env
    expose:
      - "3000"
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
volumes:
  pgdata:
  caddy_data:
  caddy_config:
YAML

if [ -n "$GHCR_TOKEN" ]; then
  echo "==> docker login ghcr.io"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
fi

echo "==> Pull + up"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

cat <<MSG

================================================================
 ✅ Stack is starting at: $URL
 Create your admin login (then log in at $URL):
   cd $DIR && docker compose -f docker-compose.prod.yml run --rm app \\
     node scripts/create-admin.mjs you@firma.pl 'StrongPass123' 'Imie Nazwisko'
 Logs:  docker compose -f $DIR/docker-compose.prod.yml logs -f app
================================================================
MSG
