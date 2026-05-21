# ─── Builder Stage ───
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for node-gyp, bcrypt, etc.
RUN apk add --no-cache python3 make g++

# We only need the files to install and build
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/

# Install dependencies (workspaces will link)
RUN npm install

# Copy source code
COPY apps/api ./apps/api/
COPY packages ./packages/

# Generate Prisma Client and Build TS
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# ─── Production Stage ───
FROM node:20-alpine AS runner

WORKDIR /app

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S expressjs -G nodejs

# Install production dependencies only
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
RUN npm ci --omit=dev

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/types/dist ./packages/types/dist

WORKDIR /app/apps/api

# Run as non-root user
USER expressjs

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Start the API server by default
CMD ["node", "dist/server.js"]
