# Kirby Brawler — static-site container
# Single self-contained HTML game served by nginx:alpine (~7MB image)

FROM nginx:alpine

# Custom server config (gzip, no-cache for dev iteration, SPA fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Serve the game at the root path
COPY kirby-abilities.html /usr/share/nginx/html/index.html

# Healthcheck so `docker ps` shows the container is actually serving
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80
