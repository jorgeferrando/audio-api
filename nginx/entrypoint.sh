#!/bin/sh
# Replace env var in nginx config template
export API_KEY_VALUE="${API_KEY:-}"
envsubst '${API_KEY_VALUE}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
