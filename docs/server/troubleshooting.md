# Troubleshooting playbook

Symptom → diagnosis → fix. The first three are real incidents from the ozk-api
rollout (July 2026) — start every session with `srv doctor`.

## HTTPS: `tlsv1 alert internal error` (curl exit 35)

**Meaning:** Caddy answered on 443 but **has no certificate for that
hostname**. Firewall and DNS are fine (the handshake reached Caddy).

1. `curl -sI http://<domena>/` — a `308` redirect proves the site block is
   loaded; then it's purely certificate issuance.
2. Check why issuance failed:
   ```bash
   cd /opt/caddy && docker compose logs --tail 200 caddy | grep -iE "<domena>|acme|obtain|error"
   ```
3. Typical causes and fixes:
   - **retry backoff** (`will retry … in …`): Caddy tried before DNS
     propagated. Force a fresh attempt: `docker compose restart caddy`
     (2–3 s blip for all sites). *This fixed the real incident.*
   - **`rateLimited`**: too many failed attempts; the log says when the window
     resets — wait, then restart caddy.
   - **AAAA record** pointing elsewhere: `dig +short AAAA <domena>` must be
     empty or correct.
   - **CAA**: `dig +short CAA ochronazklasa.pl` must include
     `letsencrypt.org` (it does).

## HTTPS works but returns 502 Bad Gateway

**Meaning:** Caddy can't reach the upstream. The Caddy error log names the
exact dial target — read it, it disambiguates instantly:

```bash
cd /opt/caddy && docker compose logs --tail 30 caddy | grep -iE "dial|upstream"
```

- **`lookup <nazwa> … server misbehaving` / `no such host`** — the Caddyfile
  upstream doesn't match any compose service name on `edge`. *Real incident:
  the block still said `reverse_proxy myapi:4000` (template placeholder)
  instead of `ozk-api:4000`.* Fix the name, `srv caddy-reload`.
- **`connection refused`** — name resolved, nothing listening: the app
  container is down/crashlooping (`cd /opt/<stack> && docker compose ps` +
  `srv logs <stack>`) or the port in the Caddyfile is wrong.
- **timeout** — container running but app not listening on `0.0.0.0`, or one
  side is missing from `edge`:
  ```bash
  docker network inspect edge --format '{{range .Containers}}{{.Name}}  {{end}}'
  ```
  Both caddy and the app must be listed.
- **Bypass Caddy to isolate the layer:**
  ```bash
  docker run --rm --network edge curlimages/curl -sS -m5 http://<serwis>:<port>/api/health
  ```
  Works → problem is the Caddyfile. Fails → problem is the app/stack.

## Edited the Caddyfile but the change "doesn't work"

**Real incident.** The Caddyfile is bind-mounted into the container as a
*single file*. `sed -i` and most editors save by writing a **new inode** and
renaming it — the container keeps reading the **old inode**, so the running
Caddy (and even `caddy validate`/`reload`, which read the in-container copy!)
still see the pre-edit content, while `cat` on the host shows the new one.

**Fix:** `srv caddy-reload` — it compares host vs in-container checksums and
force-recreates the caddy container automatically when they differ (~3 s blip).
Manual equivalent: `cd /opt/caddy && docker compose up -d --force-recreate`.

**Rule:** after *any* Caddyfile edit, always go through `srv caddy-reload`,
never bare `caddy reload`.

## Static site suddenly returns 404 after a deploy

Same inode trap as the Caddyfile, one level up: `/opt/ozk-www/dist` is a
**bind-mounted directory**. Replacing it (`mv dist dist-old && mv dist-new
dist`) leaves the container mounted on the *old, now-deleted* inode — files
look perfect on the host, every request 404s.

**Fix now:** `cd /opt/ozk-www && docker compose up -d --force-recreate`
**Fix forever:** deploy by syncing *contents* into the existing directory —
`rsync -a --delete dist-new/ dist/` — which the workflow now does, followed by
an automatic HTTP 200 check.

## `docker compose up` fails: env file not found

`env_file: .env` is mandatory in every stack — compose refuses to start
without the file. Create `/opt/<stack>/.env` (each app repo has
`.env.example`), `chmod 600`, retry. This is deliberate: it prevents a
service from silently starting with default/empty config.

## `docker compose pull` → 401 / denied

The GHCR package is private (default for private repos). Either log the server
in once — `docker login ghcr.io -u mkzaborowski` with a `read:packages` PAT —
or make the package public (GitHub → profile → Packages → package → settings).
Note: `ochronazklasa-api`'s image stays **private** on purpose (licensed PPMori
fonts inside).

## Container is `Restarting` in a loop

```bash
srv logs <stack> 50
```

Usual causes: malformed `.env` value, missing required env (the API refuses to
start in `p24` mode without P24 credentials — intentional), or OOM-kill
(`docker inspect <kontener> --format '{{.State.OOMKilled}}'` — if `true`,
raise `mem_limit` after checking for leaks).

## GitHub Actions deploy job fails

- **build job failed** → the image is broken; read the build log in the PR/run.
- **deploy job failed, build green** → SSH layer: missing repo secrets
  (`SSH_HOST`/`SSH_USER`/`SSH_KEY`), `/opt/<stack>` or its `.env` missing on
  the server (the `sed` on `API_IMAGE`/`APP_IMAGE` needs the line present), or
  GHCR pull auth (add `GHCR_PAT` secret). The image is already on GHCR at this
  point — you can always deploy manually: fix the cause, then
  `cd /opt/<stack> && docker compose pull && docker compose up -d`.

## Disk filling up

`srv doctor` warns at 80 %. Reclaim safely:

```bash
docker image prune -f            # bezpieczne: tylko nieotagowane/nieużywane obrazy
du -sh /opt/backups              # retencja trzyma 14 kopii; obniż KEEP_BACKUPS w srv
docker system df                 # co naprawdę zajmuje miejsce
```

Never `docker system prune --volumes` — that can delete databases.

## Total blackout checklist

1. Hetzner console → is the VM up? (reboot from there if SSH is dead)
2. `systemctl status docker` on the box.
3. `srv status` → which stacks are down; `docker compose up -d` per stack
   (order doesn't matter; caddy reconnects to upstreams dynamically).
4. `srv doctor` until clean.
5. Worst case: fresh VM → install docker → recreate `/opt` layout from the
   latest `/opt/backups/<DATE>/` (compose files + envs + Caddyfile are all in
   there) → restore DBs per [maintenance.md](maintenance.md).
