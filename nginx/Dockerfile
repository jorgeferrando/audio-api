FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY templates/ /etc/nginx/templates/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
