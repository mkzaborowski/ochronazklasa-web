# Server architecture — Hetzner box (167.233.204.214)

The single Hetzner server (8 GB RAM / 75 GB disk) hosts every backend service
behind one shared Caddy reverse proxy. Each service is an isolated Docker
Compose stack in its own `/opt/<name>` directory; stacks meet only on the
shared `edge` Docker network. Deploying or breaking one stack cannot touch
another.

> These docs replace the older `MULTI-APP.md` (the layout changed: Caddy now
> runs as its own stack in `/opt/caddy`, not inside `/opt/ochrona`).

## The picture

```
                    Internet
                       │  (only 22, 80, 443 open)
                       ▼
        ┌──────  Caddy  /opt/caddy  ──────┐   TLS: automatic Let's Encrypt
        │ routes by Host header:          │
        │  panel/web domain ─► app:3000   │──► /opt/ochrona   (Next.js + Postgres)
        │  api.ochronazklasa.pl           │
        │        ─► ozk-api:4000          │──► /opt/ozk-api   (EDU Plus purchase API + SQLite)
        └──────────────────────────────────┘
                       ▲
              docker network "edge" (external, shared)

  ochronazklasa.pl (static Vite site)  ── hosted elsewhere, calls api.* over HTTPS
```

## Key invariants (what keeps everything safe)

1. **One stack = one directory** — `/opt/<name>/docker-compose.yml` + `.env` +
   its own volumes. Never mix files between stacks.
2. **No service publishes host ports.** Only Caddy binds 80/443. Services use
   `expose:` and are reachable exclusively through the `edge` network — the
   firewall stays 22/80/443 forever.
3. **Routing is name-based**: a Caddyfile block `reverse_proxy <service>:<port>`
   resolves the *compose service name* via Docker DNS on `edge`. Rename a
   service ⇒ update the Caddyfile.
4. **Databases stay inside their stack** (ochrona's Postgres, ozk-api's SQLite
   volume) — never shared between apps.
5. **Every service has `mem_limit`** (512m default) so a leak cannot starve the
   box.
6. **Config changes to shared pieces (Caddyfile) are backed up first** and
   validated (`caddy validate`) before reload. Reload is zero-downtime.

## Repositories → images → deployments

| Repo | What | Deploys to | How |
|---|---|---|---|
| `ochronazklasa-web` | Next.js panel + Postgres | `/opt/ochrona` | GH Actions `deploy.yml`: build image → GHCR → SSH: pin `APP_IMAGE` by SHA in `.env` → `compose up -d` |
| `ochronazklasa-api` | EDU Plus purchase API | `/opt/ozk-api` | GH Actions `deploy.yml`: same pattern, pins `API_IMAGE` |
| `ochronazklasa` | static marketing site (Vite) | static hosting (not this server) | built with `VITE_API_BASE_URL=https://api.ochronazklasa.pl` |
| — | Caddy | `/opt/caddy` | hand-edited Caddyfile + `srv caddy-reload` |

Both CI deploys pin images by commit SHA (`sed` on the server `.env`), so
`docker compose ps` always tells you exactly which commit runs, and rollback is
"set the previous SHA and `up -d`".

## Documentation index

- [services.md](services.md) — inventory of every stack: what runs, env, volumes, endpoints
- [adding-a-service.md](adding-a-service.md) — checklist for adding the next app
- [maintenance.md](maintenance.md) — the `srv` tool, routine tasks, backups & restore
- [troubleshooting.md](troubleshooting.md) — symptom → cause → fix playbook (from real incidents)

## The `srv` tool

One script drives day-to-day operations: `srv status`, `srv doctor`,
`srv backup`, `srv update <stack>`, `srv caddy-reload`… It auto-discovers
stacks (any `/opt/*` with a compose file) and domains (from the Caddyfile), so
new services need zero script changes. Source lives in this repo at
[`deploy/srv`](../../deploy/srv); details in [maintenance.md](maintenance.md).
