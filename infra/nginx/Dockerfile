FROM nginx:1.30.6-alpine
COPY infra/nginx/*.template /etc/dashdevil/
COPY --chmod=755 infra/nginx/render-config.sh /usr/local/bin/render-config
COPY --chmod=755 infra/nginx/start.sh /usr/local/bin/start-nginx
EXPOSE 80/tcp 443/tcp
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8081/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/start-nginx"]
