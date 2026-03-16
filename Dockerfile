FROM nginx:1.27-alpine

# Copy the single-file dashboard
COPY index.html /usr/share/nginx/html/index.html

# Copy supporting files
COPY agent_state_example.json /usr/share/nginx/html/agent_state_example.json

# Minimal nginx config — serve index.html, enable SPA-style 404 fallback
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
    # Required for File Watch mode: allow cross-origin JSON fetch from same host\n\
    add_header Access-Control-Allow-Origin *;\n\
  }\n\
  # Health check endpoint\n\
  location /health {\n\
    return 200 "ok";\n\
    add_header Content-Type text/plain;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
