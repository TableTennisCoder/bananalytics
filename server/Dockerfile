# Build stage
FROM golang:1.22-alpine AS builder

RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /rochade ./cmd/rochade

# Production stage
FROM alpine:3.19

# Security: run as non-root user
RUN addgroup -S rochade && adduser -S rochade -G rochade
RUN apk --no-cache add ca-certificates

COPY --from=builder /rochade /rochade

# Switch to non-root user
USER rochade

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["/rochade"]
