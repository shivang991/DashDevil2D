# syntax=docker/dockerfile:1
FROM golang:1.26.0-bookworm AS build
WORKDIR /src
COPY apps/server/go.mod apps/server/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY apps/server/ ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -mod=readonly -buildvcs=false -trimpath -o /out/server ./cmd/diagnostic

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/server /usr/local/bin/dashdevil-server
COPY --chmod=755 infra/server/start.sh /usr/local/bin/start-server
EXPOSE 8443/tcp 8443/udp
ENTRYPOINT ["/usr/local/bin/start-server"]
