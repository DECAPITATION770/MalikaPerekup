# Deploying Malika

Production deploy of the full stack (Mini App + admin panel + API/bot +
Postgres + Redis) on a single Linux host with Docker, behind an nginx edge
proxy with Let's Encrypt TLS.

```
Internet ──443──▶ edge (nginx, TLS)
                   ├─ app.<domain>   → tenant  (Mini App SPA)  + /api → backend
                   └─ admin.<domain> → admin    (admin SPA)     + /api → backend
backend (FastAPI + aiogram bot) ─▶ postgres, redis, object storage (R2/MinIO)
```

Only the edge container is exposed to the internet; everything else lives on
the internal Docker network.

---

## 0. Prerequisites

- A Linux server (2 vCPU / 2 GB RAM is plenty for the market’s scale) with a
  public IP, ports **80** and **443** open.
- Docker Engine + Compose plugin (`docker compose version` ≥ 2.20).
- Two DNS **A** records pointing at the server:
  - `app.<domain>`   — the Telegram Mini App
  - `admin.<domain>` — the platform admin panel
- A Telegram bot from [@BotFather](https://t.me/BotFather).
- Object storage: a **Cloudflare R2** bucket (recommended) — or self-host MinIO.

---

## 1. Get the code & configure

```bash
git clone <repo> malika && cd malika
cp deploy/.env.prod.example deploy/.env.prod
$EDITOR deploy/.env.prod          # fill EVERY CHANGE_ME (see notes in the file)
```

Generate secrets:
```bash
openssl rand -hex 32     # → JWT_SECRET
openssl rand -hex 24     # → POSTGRES_PASSWORD (also put it in DATABASE_URL)
```

Edit `deploy/nginx/malika.conf` and replace `app.example.uz` /
`admin.example.uz` with your real hosts (3 spots each).

> The backend **refuses to start** in prod if `JWT_SECRET` is a known dev
> placeholder / shorter than 32 chars, if `DEV_AUTH_BYPASS=true`, or if
> `DEBUG=true`. This is intentional (`app/core/config.py`).

---

## 2. TLS certificates (Let's Encrypt)

Issue certs once with a throwaway certbot run (HTTP-01 via the shared webroot):

```bash
mkdir -p deploy/certbot/www

# Bring up just the edge first so port 80 can answer the ACME challenge.
# (Temporarily comment the two `ssl`/`listen 443` server blocks, or use the
#  --standalone method below.)
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v "$PWD/deploy/certbot/www:/var/www/certbot" \
  -p 80:80 certbot/certbot certonly --standalone \
  -d app.<domain> -d admin.<domain> \
  --email you@example.com --agree-tos --no-eff-email
```

Certs land in `/etc/letsencrypt/live/<host>/` — already mounted read-only
into the edge container. Renewal (cron, monthly):

```bash
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -p 80:80 \
  certbot/certbot renew && docker compose -f deploy/docker-compose.prod.yml exec edge nginx -s reload
```

---

## 3. Object storage

### Option A — Cloudflare R2 (recommended)
1. Create a **private** bucket `malika-perekup`.
2. Create an R2 API token (Object Read & Write); put the key/secret in
   `deploy/.env.prod`.
3. Set `S3_ENDPOINT` and `S3_PUBLIC_ENDPOINT` to the R2 endpoint host (or a
   custom domain bound to the bucket). Keep the bucket private — files are
   only ever served via short-lived presigned URLs.
4. **CORS**: allow `PUT, GET` from `https://app.<domain>` (R2 dashboard →
   bucket → Settings → CORS), else browser uploads are blocked by the
   browser’s preflight.

### Option B — self-hosted MinIO
Start the stack with `--profile selfhost-storage`, set the MinIO vars
(see `.env.prod.example`), add a `cdn.<domain>` server block to the nginx
config proxying to `minio:9000`, and point `S3_PUBLIC_ENDPOINT=cdn.<domain>`.
Set the bucket CORS to allow the Mini App origin.

---

## 4. Bring it up

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

This builds the three images, runs DB migrations (`migrate` service →
`alembic upgrade head`), then starts backend (API + bot polling), the two
SPAs, and the edge proxy. The first platform admin is seeded from
`BOOTSTRAP_ADMIN_*` on first boot.

Check health:
```bash
docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml logs -f backend
curl -fsS https://app.<domain>/api/v1/health        # → {"status":"ok"}
```

---

## 5. Telegram setup

In @BotFather:
- **Bot Settings → Menu Button → Configure** → URL `https://app.<domain>`
- (or **/setdomain** / Web App URL) — must match `BOT_WEBAPP_URL`.

Open the bot, tap the menu button → the Mini App loads. Owners are created by
a platform admin (admin panel → "Создать магазин"); they then sign in via
Telegram, or with the login/password set for them.

---

## 6. Day-2 operations

**Update to a new version**
```bash
git pull
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
# migrations run automatically via the `migrate` service before backend starts
```

**Backups** — the app ships an integrated backup system (DB dump + all object
storage files + manifest, one `.tar.gz`). Configure schedule, retention and
Telegram delivery in the admin panel → **Backup**, or run it on demand:
```bash
docker compose -f deploy/docker-compose.prod.yml exec backend \
  python -m scripts.backup
# restore (DESTRUCTIVE — overwrites DB and bucket):
docker compose -f deploy/docker-compose.prod.yml exec backend \
  python -m scripts.restore /backups/<archive>.tar.gz --yes
```
Archives live in the `backup_data` volume mounted at `/backups`. The backend
image bundles `pg_dump`/`pg_restore` 16. **Copy the `backup_data` volume
off-site** (the archives contain PII) — e.g. periodically:
```bash
docker run --rm -v malika_backup_data:/b -v "$PWD":/out alpine \
  tar czf /out/backups-$(date +%F).tar.gz -C /b .
```
For R2, also enable bucket versioning / lifecycle in the Cloudflare dashboard.

**Logs**: `docker compose -f deploy/docker-compose.prod.yml logs -f <service>`
**Restart one service**: `... restart backend`
**Stop all**: `... down`   (add `-v` to also drop volumes — destroys data)

---

## 7. Pre-flight checklist

- [ ] `deploy/.env.prod` filled, every `CHANGE_ME` replaced, file NOT committed
- [ ] `JWT_SECRET` ≥ 32 random chars; `POSTGRES_PASSWORD` matches `DATABASE_URL`
- [ ] DNS `app.` and `admin.` resolve to the server
- [ ] TLS certs issued for both hosts
- [ ] nginx `malika.conf` hosts replaced (`app.example.uz` / `admin.example.uz`)
- [ ] R2 bucket is **private** + CORS allows `https://app.<domain>`
- [ ] `BOT_WEBAPP_URL` == BotFather Web App URL == `https://app.<domain>`
- [ ] `curl https://app.<domain>/api/v1/health` returns ok
- [ ] First admin can log into `https://admin.<domain>`
- [ ] Smoke test: create shop → owner logs in → purchase → upload a photo →
      it appears on the device card (verifies presigned upload end-to-end)
```
