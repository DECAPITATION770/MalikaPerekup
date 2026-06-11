# syntax=docker/dockerfile:1.7
# Build the tenant Mini App and serve the static bundle with nginx.
# Mirrors admin/Dockerfile but uses pnpm (tenant's package manager).

# ─── Build stage ────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable
WORKDIR /app

# Lockfile-first so the dependency layer caches independently of source.
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
# `pnpm build` = `tsc -b && vite build`. No VITE_* build args required —
# the API base is the relative path `/api/v1` (the edge proxy routes it),
# and Sentry/analytics self-disable when their env vars are absent.
RUN pnpm build

# ─── Runtime stage ──────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
