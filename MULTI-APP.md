# Hosting more services/APIs on the same Hetzner server

How to add apps next to ochronazklasa-web **without endangering it**. The design:
one shared Caddy (ports 80/443) routes by domain; every app lives in its own
directory + its own compose stack; stacks meet on the shared `edge` docker
network. Deploying/breaking one app cannot touch another.

```
Internet ──► Caddy (:80/:443, in /opt/ochrona stack)
              ├─ web.ochronazklasa.pl ──► app:3000        (ochrona default net)
              ├─ api.example.pl       ──► myapi:4000      (edge net)
              └─ inne.example.pl      ──► other:8080      (edge net)
```

## Iron rules (what keeps ochronazklasa safe)

1. **Never touch `/opt/ochrona`** when working on other apps — each new app gets
   its own `/opt/<name>` with its own compose, `.env`, volumes.
2. **New apps expose no host ports.** Use `expose:` (container-network only) —
   traffic enters exclusively through Caddy. Firewall stays 22/80/443.
3. **Own Postgres per app** (in its stack) rather than sharing ochrona's DB
   container — a heavy migration or restart in app B must not lock app A's DB.
4. **Backup before any change to the shared pieces** (Caddyfile / ochrona
   compose): `cd /opt/ochrona && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U ochrona ochronazklasa | gzip > backups/$(date +%F).sql.gz`
5. **Memory limits on new services** (`mem_limit: 512m`) so a leak can't starve
   the box. Check headroom with `docker stats --no-stream` (stack uses ~0.4 GB
   of 8 GB today).

## One-time groundwork (already done)

```bash
docker network create edge                    # shared app<->caddy network
# caddy joined to it via docker-compose.prod.yml (networks: default + edge)
```

## Adding a new service — checklist

**1. DNS** — A record: `api.twojadomena.pl → 167.233.204.214`.

**2. Directory + stack** on the server:
```bash
mkdir -p /opt/myapi && cd /opt/myapi
```
`/opt/myapi/docker-compose.yml` (template — see also `deploy/new-service.template.yml`):
```yaml
services:
  myapi:
    image: ghcr.io/mkzaborowski/myapi:latest
    restart: unless-stopped
    env_file: .env
    expose: ["4000"]        # NOT ports: — no host exposure
    mem_limit: 512m
    networks: [edge]
  # optional own database:
  # db:
  #   image: postgres:16
  #   restart: unless-stopped
  #   environment: { POSTGRES_PASSWORD: "...", POSTGRES_DB: myapi }
  #   volumes: [ myapi_pgdata:/var/lib/postgresql/data ]
  #   networks: [default]   # DB only reachable inside this stack

networks:
  edge:
    external: true

# volumes:
#   myapi_pgdata:
```
```bash
docker compose up -d
```

**3. Route in Caddy** — append to `/opt/ochrona/Caddyfile`:
```
api.twojadomena.pl {
    reverse_proxy myapi:4000
}
```
Reload (no downtime for other sites):
```bash
cd /opt/ochrona && docker compose -f docker-compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```
Caddy fetches the TLS certificate automatically on first request.

**4. (Optional) its own CI/CD** — copy `.github/workflows/deploy.yml` into the
new repo, point the remote script at `/opt/myapi`, reuse the same
`SSH_HOST`/`SSH_USER`/`SSH_KEY` secrets. Deploys stay fully independent.

## Removing a service

```bash
cd /opt/myapi && docker compose down          # add -v to drop its volumes
# remove its block from /opt/ochrona/Caddyfile + caddy reload
```
Nothing else is affected.

## Capacity

Server: 8 GB RAM / 75 GB disk; ochrona stack ≈ 0.4 GB RAM / 6 GB disk. Rule of
thumb: a typical Node/Go/Python API + small Postgres ≈ 0.3–0.7 GB RAM. Watch
`docker stats`; if RAM pressure appears, resize the server in Hetzner console
(disk/IP survive, ~1 min downtime).
