# Deploying Malika Perekup

Production deploy of the full stack (Mini App + admin panel + API/bot +
Postgres + Redis + MinIO) on the shared host `178.128.84.144`.

This host runs a **system nginx (:80)** as the shared reverse proxy for
several projects, with **TLS terminated at Cloudflare**. So this stack does
**not** run its own edge/certbot — it binds its containers to `127.0.0.1`
high ports and the host nginx proxies the public sub-domains to them.

```
Cloudflare (TLS) ──http──▶ host nginx :80
   perekup-app.iboshka.xyz   → 127.0.0.1:3010  tenant Mini App (self-proxies /api → backend)
   perekup-admin.iboshka.xyz → 127.0.0.1:3011  admin panel     (self-proxies /api → backend)
   perekup-s3.iboshka.xyz    → 127.0.0.1:9120  MinIO (browser pre-signed URLs)

internal docker net `perekup`:  backend (FastAPI + aiogram bot, polling)
                                 ├─ postgres   ├─ redis   └─ minio:9000
```

Postgres, Redis and the backend are never published to the host. The bot
runs in **long-polling** mode, so the backend needs no public ingress.

---

## 1. DNS (already done)

All three hosts are **one level** under `iboshka.xyz`, so they are covered by
Cloudflare's existing `*.iboshka.xyz` Universal SSL and resolve to the origin
via the proxied `*.iboshka.xyz` record. Nothing to add. (Two-level names like
`app.perekup.iboshka.xyz` would need paid Advanced Certificate Manager — that
is why the flat `perekup-*` scheme is used.)

## 2. Get the code & configure

```bash
# on the server
cd /root/MalikaPerekup
cp deploy/.env.prod.example deploy/.env.prod
$EDITOR deploy/.env.prod            # fill every CHANGE_ME
```

Generate the secrets:
```bash
openssl rand -hex 32     # → JWT_SECRET
openssl rand -hex 24     # → POSTGRES_PASSWORD (also paste into DATABASE_URL)
openssl rand -hex 16     # → S3_ACCESS_KEY
openssl rand -hex 24     # → S3_SECRET_KEY
```
Telegram secrets that live **only** on the server (never committed):
`BOT_TOKEN`, `BOOTSTRAP_ADMIN_TG_IDS` (operator's Telegram id).

> The backend refuses to start in prod if `JWT_SECRET` is a known dev
> placeholder / shorter than 32 chars, if `DEV_AUTH_BYPASS=true`, or if
> `DEBUG=true` (`app/core/config.py`).

## 3. Bring it up

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

Builds the three images, runs DB migrations (`migrate` → `alembic upgrade
head`), then starts backend (API + bot polling), the two SPAs and MinIO.
The first platform admin is seeded from `BOOTSTRAP_ADMIN_*` on first boot;
the MinIO bucket is auto-created by the backend (`ensure_bucket`).

```bash
docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml logs -f backend
# backend health (root /health, internal :8000):
docker compose -f deploy/docker-compose.prod.yml exec backend \
  python -c "import urllib.request;print(urllib.request.urlopen('http://localhost:8000/health').read())"
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/    # SPA → 200
```

## 4. Host nginx

```bash
cp deploy/nginx/perekup.conf /etc/nginx/sites-available/perekup
ln -sf ../sites-available/perekup /etc/nginx/sites-enabled/perekup
nginx -t && systemctl reload nginx
curl -s -o /dev/null -w '%{http_code}\n' https://perekup-app.iboshka.xyz/   # via Cloudflare → 200
curl -s -o /dev/null -w '%{http_code}\n' https://perekup-app.iboshka.xyz/api/v1/me  # → 401 (API reachable)
```

## 5. Telegram

`BOT_WEBAPP_URL=https://perekup-app.iboshka.xyz` is set in `.env.prod`. Set
the bot's menu button to open the Mini App (one-off, via Bot API or
@BotFather → Menu Button):
```bash
curl -s "https://api.telegram.org/bot$BOT_TOKEN/setChatMenuButton" \
  -H 'Content-Type: application/json' \
  -d '{"menu_button":{"type":"web_app","text":"Открыть","web_app":{"url":"https://perekup-app.iboshka.xyz"}}}'
```
Owners are created by a platform admin (admin panel → "Создать магазин"),
then sign in via Telegram or with the login/password set for them.

## 6. Day-2 operations

**Update**
```bash
cd /root/MalikaPerekup && git pull   # (or re-rsync)
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

**Backups** — DB dump + all object-storage files + manifest in one
`.tar.gz`. Schedule/retention/Telegram delivery in admin panel → **Backup**,
or on demand:
```bash
docker compose -f deploy/docker-compose.prod.yml exec backend python -m scripts.backup
# restore (DESTRUCTIVE):
docker compose -f deploy/docker-compose.prod.yml exec backend python -m scripts.restore /backups/<archive>.tar.gz --yes
```
Archives live in the `backup_data` volume; copy it off-site periodically
(contains PII).

**Logs**: `... logs -f <service>` · **Restart one**: `... restart backend`
**Stop all**: `... down`  (add `-v` to drop volumes — destroys data).

## 7. Pre-flight checklist

- [ ] `deploy/.env.prod` filled, every `CHANGE_ME` replaced, NOT committed
- [ ] `JWT_SECRET` ≥ 32 random chars; `POSTGRES_PASSWORD` matches `DATABASE_URL`
- [ ] containers up; `curl -o/dev/null -w'%{http_code}' 127.0.0.1:3010/` → 200
- [ ] host nginx site enabled; `https://perekup-app.iboshka.xyz` loads via Cloudflare
- [ ] bot menu button → `https://perekup-app.iboshka.xyz`
- [ ] admin can log into `https://perekup-admin.iboshka.xyz`
- [ ] smoke: create shop → owner logs in → purchase → upload a photo →
      it appears on the device card (verifies pre-signed upload end-to-end)
