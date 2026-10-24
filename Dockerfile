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
 && find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' -o -name '*.json' -o -name '*.webmanifest' \) -exec gzip -9 -k {} \;

# ---- serve ----
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html/panel
# Source maps stay out of the public image (upload them to an error tracker instead).
RUN find /usr/share/nginx/html \( -name '*.map' -o -name 'mockServiceWorker.js*' \) -delete
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/panel/healthz >/dev/null || exit 1
