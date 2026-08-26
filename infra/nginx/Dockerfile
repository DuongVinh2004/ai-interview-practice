FROM nginxinc/nginx-unprivileged:1.27.2-alpine@sha256:5318ef1dbe33bebd2312c4ad64731c424d68fa0f7349870dda10b8d173fedc2e
COPY nginx.conf /etc/nginx/nginx.conf
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
