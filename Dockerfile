FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine

# Copy admin panel build
COPY --from=builder /app/dist /usr/share/nginx/html

# Generate runtime OpenClaw config for the frontend from container env
RUN printf '%s\n' \
  '#!/bin/sh' \
  'set -eu' \
  'gateway_url="${OPENCLAW_GATEWAY_URL:-}"' \
  'if [ -z "$gateway_url" ]; then' \
  '  if [ "${OPENCLAW_FORCE_HTTPS:-0}" = "1" ]; then proto="wss"; else proto="ws"; fi' \
  '  gateway_url="${proto}://${OPENCLAW_PUBLIC_HOST:-${HOSTNAME:-localhost}}/openclaw"' \
  'fi' \
  'cat > /usr/share/nginx/html/openclaw-config.json <<EOF' \
  '{' \
  '  "gatewayToken": ${OPENCLAW_GATEWAY_TOKEN:+\"$OPENCLAW_GATEWAY_TOKEN\"},' \
  '  "gatewayUrl": ${gateway_url:+\"$gateway_url\"},' \
  '  "uiPassword": ${OPENCLAW_UI_PASSWORD:+\"$OPENCLAW_UI_PASSWORD\"}' \
  '}' \
  'EOF' \
  > /docker-entrypoint.d/40-openclaw-config.sh \
  && chmod +x /docker-entrypoint.d/40-openclaw-config.sh

# Copy chat interface archive for reference/migration
COPY chat-interface /usr/share/nginx/html/chat-archive

# Custom nginx config: SPA routing + API/WebSocket proxy to rempai
# Security: Only proxy specific API paths, deny everything else
RUN echo 'server { \
    listen 80; \
    \
    # OpenClaw gateway root (WebSocket + RPC endpoint) proxied through LAN admin UI \
    location = /openclaw { \
        proxy_pass https://host.docker.internal:18789/; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_ssl_server_name on; \
        proxy_ssl_verify off; \
        proxy_read_timeout 300s; \
        proxy_hide_header X-Frame-Options; \
        proxy_hide_header Content-Security-Policy; \
        add_header X-Frame-Options "SAMEORIGIN" always; \
        add_header Content-Security-Policy "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self' 'sha256-RxCZFmTWY/yQmhYxMDn+blaCuwLzOsV/XsVb0n5EkRU='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss:;" always; \
    } \
    \
    # OpenClaw control UI and assets \
    location /openclaw/ { \
        proxy_pass https://host.docker.internal:18789/; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_ssl_server_name on; \
        proxy_ssl_verify off; \
        proxy_read_timeout 300s; \
        proxy_hide_header X-Frame-Options; \
        proxy_hide_header Content-Security-Policy; \
        add_header X-Frame-Options "SAMEORIGIN" always; \
        add_header Content-Security-Policy "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self' 'sha256-RxCZFmTWY/yQmhYxMDn+blaCuwLzOsV/XsVb0n5EkRU='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss:;" always; \
    } \
    \
    # Serve the React chat route directly and disable caching for the entrypoint \
    location = /chat { \
        root /usr/share/nginx/html; \
        add_header Cache-Control "no-store" always; \
        try_files /index.html =404; \
    } \
    \
    # Retire the old Rem chat API surface; chat now goes through OpenClaw \
    location /api/chat/ { \
        return 410; \
    } \
    \
    # Block /api/admin/setup/ with trailing slash — exact match variant \
    location = /api/admin/setup/ { \
        return 403; \
    } \
    \
    # Block /api/admin/setup — no auth on fresh deploy, blocks attacker from claiming admin ownership \
    location = /api/admin/setup { \
        return 403; \
    } \
    \
    # Admin API endpoints \
    location /api/admin/ { \
        proxy_pass http://rempai:8001; \
        proxy_http_version 1.1; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_buffering off; \
        proxy_cache off; \
        proxy_read_timeout 300s; \
    } \
    \
    # Deny all other /api/ requests (security) \
    location /api/ { \
        return 403; \
    } \
    \
    # WebSocket proxy for gateway \
    location /ws/ { \
        proxy_pass http://rempai:8001; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
    } \
    \
    # Serve frontend with SPA routing \
    location / { \
        root /usr/share/nginx/html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
