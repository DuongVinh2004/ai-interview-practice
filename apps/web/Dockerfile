# Stage 1: Base
FROM node:22.13.0-alpine3.20@sha256:db8dcb90326a0116375414e9a7c068a6b87a4422b7da37b5c6cd026f7c7835d3 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install --global --ignore-scripts corepack@0.34.0 \
    && corepack enable \
    && corepack prepare pnpm@11.0.9 --activate

# Stage 2: Dependencies
FROM base AS dependencies
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# Stage 3: Builder
FROM base AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY --from=dependencies /app/apps/web/node_modules ./apps/web/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter contracts build
RUN pnpm --filter web build

# Stage 4: Production Static Web Server
FROM nginxinc/nginx-unprivileged:1.27.2-alpine@sha256:5318ef1dbe33bebd2312c4ad64731c424d68fa0f7349870dda10b8d173fedc2e AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY infra/nginx/web.conf /etc/nginx/conf.d/default.conf
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
