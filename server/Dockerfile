# Stage 1: Dependencies
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy package files (bun.lock for Bun 1.2+, bun.lockb for older versions)
COPY package.json bun.lock* bun.lockb* ./

# Install production dependencies
RUN bun install --frozen-lockfile --production

# Stage 2: Build
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files (bun.lock for Bun 1.2+, bun.lockb for older versions)
COPY package.json bun.lock* bun.lockb* ./

# Install all dependencies (including dev dependencies)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# TypeScript type checking
RUN bun run tsc --noEmit

# Stage 3: Runtime
FROM oven/bun:1-alpine AS runtime

# Install FFmpeg and dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    ca-certificates

# Install yt-dlp
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Default to API role. Override with `docker run ... bun run start:worker`
# or via docker-compose `command:` to run as a worker.
ENV ROLE=api

# Expose port (only used when ROLE=api)
EXPOSE 8787

# Health check targets the API role only. Worker containers should override
# or disable the healthcheck in their compose service.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD bun run -e 'fetch("http://localhost:8787/health").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

# Start the API server by default. Worker service overrides CMD in compose.
CMD ["bun", "run", "start:api"]
