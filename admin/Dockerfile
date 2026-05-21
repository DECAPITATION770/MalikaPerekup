# syntax=docker/dockerfile:1.7
# Build the admin panel and serve with nginx.

# ─── Build stage ────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# ─── Runtime stage ──────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# nginx config: serve SPA, proxy /api/* to backend
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
