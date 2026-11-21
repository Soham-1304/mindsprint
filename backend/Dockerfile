# Section 3 Control Plane Dockerfile (SRE Agent + Sietch 3-Layer Preventive Suite)
#
# Build from the sre-agent/ root context:
#   1. (For Cloud / Render / Railway / GCP where Kiroween isn't on disk):
#      ./backend/scripts/vendor-sietch.sh
#   2. docker build -f backend/Dockerfile -t aegis-sre-backend .
#
# You may also override SIETCH_KIROWEEN_DIR at build/runtime if mounting Kiroween externally.

FROM node:24-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Install backend dependencies first for layer caching
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# Copy backend source (includes vendor/sietch vendored via scripts/vendor-sietch.sh)
COPY backend/ ./

# Wire vendored @sietch/core and @sietch/sandbox into node_modules for ESM resolution
RUN mkdir -p /app/backend/node_modules/@sietch \
  && ln -sfn /app/backend/vendor/sietch/base/core /app/backend/node_modules/@sietch/core \
  && ln -sfn /app/backend/vendor/sietch/base/sandbox /app/backend/node_modules/@sietch/sandbox

# Copy demo malicious package fixture at ../../../demo-packages/currency-format-lite
# relative to /app/backend/src/sietch/suite.ts
COPY demo-packages/currency-format-lite /app/demo-packages/currency-format-lite

ARG SIETCH_KIROWEEN_DIR=/app/backend/vendor/sietch
ENV SIETCH_KIROWEEN_DIR=${SIETCH_KIROWEEN_DIR}
ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD sh -c 'curl -fsS "http://localhost:${PORT:-10000}/api/health" || exit 1'

CMD ["npm", "run", "start"]
