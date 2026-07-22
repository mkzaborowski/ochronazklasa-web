# Adding a new service

Checklist for putting the next app on the server without endangering the
existing ones. Time budget: ~15 minutes plus DNS propagation.

## 0. Prerequisites in the app's repo

- A `Dockerfile` that listens on one port and ideally exposes a health endpoint
  (`/api/health` or `/healthz`).
- A deploy workflow copied from `ochronazklasa-api`'s
  `.github/workflows/deploy.yml` — adjust the image name and the `/opt/<name>`
  path in the SSH script. Add repo secrets `SSH_HOST`, `SSH_USER`, `SSH_KEY`
  (same values as the other repos), optionally `GHCR_PAT`.
- First push builds the image to GHCR. If the repo is private the package is
  private too → either flip the package public (GitHub → Packages → settings)
  or keep it private and `docker login ghcr.io` on the server with a
  `read:packages` PAT (one-time; credentials persist in `/root/.docker`).

## 1. DNS

A record: `nazwa.ochronazklasa.pl → 167.233.204.214`. Verify before touching
Caddy (avoids ACME rate-limit burn on a non-propagated domain):

```bash
dig +short nazwa.ochronazklasa.pl   # must print 167.233.204.214
```

## 2. Stack directory

```bash
mkdir -p /opt/<name> && cd /opt/<name>
```

`docker-compose.yml` — template (same rules as every stack: `expose` not
`ports`, `mem_limit`, `edge` external, volume only if the app has state):

```yaml
services:
  <name>:                      # ← this name is what Caddy will dial
    image: ${APP_IMAGE:-ghcr.io/mkzaborowski/<repo>:latest}
    restart: unless-stopped
    env_file: .env             # compose REFUSES to start without this file
    expose: ["4000"]           # NOT ports: — no host exposure, ever
    mem_limit: 512m
    networks: [edge]
    # volumes: [ <name>_data:/app/data ]   # only for stateful apps

networks:
  edge:
    external: true

# volumes:
#   <name>_data:
```

`.env` — at minimum the `APP_IMAGE` line (CI's `sed` target) plus whatever the
app needs:

```bash
cat > .env <<EOF
APP_IMAGE=ghcr.io/mkzaborowski/<repo>:latest
EOF
chmod 600 .env
docker compose pull && docker compose up -d
docker compose ps        # wait for "healthy" / "Up"
```

## 3. Route in Caddy

Append to `/opt/caddy/Caddyfile` — **the upstream must be the compose service
name from step 2** (a `myapi` placeholder left in caused a real 502 once):

```
nazwa.ochronazklasa.pl {
	encode zstd gzip
	reverse_proxy <name>:4000

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
	}
}
```

```bash
srv caddy-reload           # = caddy validate + caddy reload (zero downtime)
curl -s https://nazwa.ochronazklasa.pl/...health...
```

The certificate is issued in the background within seconds of the reload. If
HTTPS fails right after, see [troubleshooting.md](troubleshooting.md) — do not
hammer retries (Let's Encrypt rate-limits failed attempts).

## 4. Aftercare

- `srv status` — the new stack appears automatically (auto-discovery).
- `srv backup` covers its `.env` + compose file automatically; **if the app has
  its own database, add a dump step to `cmd_backup()` in `deploy/srv`** (see
  the ochrona/ozk-api examples there).
- Add the new stack row to [services.md](services.md).

## Removing a service

```bash
cd /opt/<name> && docker compose down      # -v additionally deletes its volumes (backup first!)
# remove its block from /opt/caddy/Caddyfile
srv caddy-reload
rm -r /opt/<name>                          # when sure
```

Nothing else is affected.
