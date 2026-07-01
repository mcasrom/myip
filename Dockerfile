# ==============================================================================
# MyIP - Dockerfile for Hetzner / Any VPS
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy source and build
COPY . .
RUN npm run build

# ==============================================================================
# Production image
# ==============================================================================
FROM node:20-alpine

WORKDIR /app

# Install nmap, openssl, python3 for advanced scanning (optional)
RUN apk add --no-cache nmap openssl python3

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/.env.example ./.env.example

# Install production dependencies only
RUN npm ci --production

# Security: Run as non-root user
RUN addgroup -g 1001 -S myip && adduser -S myip -u 1001 -G myip
USER myip

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/ip/detect || exit 1

# Start server
CMD ["node", "dist/server.cjs"]
