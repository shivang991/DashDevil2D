# syntax=docker/dockerfile:1
FROM golang:1.26.0-bookworm AS protocol-tools

FROM node:26.10.0-bookworm-slim AS build
COPY --from=protocol-tools /usr/local/go/bin/gofmt /usr/local/bin/gofmt
WORKDIR /workspace
RUN npm install --global pnpm@8.15.9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/simulation/package.json packages/simulation/package.json
RUN --mount=type=cache,id=dashdevil-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store
COPY apps/server/protocol/generated.go apps/server/protocol/generated.go
COPY apps/client apps/client
COPY packages/contracts packages/contracts
COPY packages/simulation packages/simulation
RUN pnpm --filter @dashdevil/contracts check:generated \
    && pnpm --filter @dashdevil/client build

FROM nginx:1.30.6-alpine AS runtime
COPY infra/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/client/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
