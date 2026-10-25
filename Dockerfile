# syntax=docker/dockerfile:1

# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
ARG VITE_ENABLE_PWA=false
ENV VITE_ENABLE_PWA=$VITE_ENABLE_PWA
RUN pnpm build \
 # Pre-compress so nginx serves .gz without spending CPU on every request.
 && find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' -o -name '*.json' -o -name '*.webmanifest' \) -exec gzip -9 -k {} \; \
 # Source maps stay out of the public image (upload them to an error tracker instead).
 && find dist -name '*.map' -delete

# ---- serve ----
# Runs as the unprivileged `nginx` user (uid 101) instead of root, so it listens on 8080.
FROM nginxinc/nginx-unprivileged:1.31-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html/panel
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/panel/healthz >/dev/null || exit 1
