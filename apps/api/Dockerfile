# Base stage for dependencies
FROM node:18-alpine AS base
WORKDIR /app

# 👇 FIX IS RIGHT HERE: Install OpenSSL 1.1 compatibility packages
RUN apk add --no-cache openssl1.1-compat

# Copy root configurations for npm workspaces
COPY package.json package-lock.json tsconfig.json ./

# Copy all workspaces/packages
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Install dependencies using npm workspaces
RUN npm ci

# Point explicitly to the schema file path
RUN npx prisma generate --schema=./apps/api/prisma/schema.prisma

# Step 1: Build the shared types package first
RUN npm run build -w packages/types

# Step 2: Build the backend API server
RUN npm run build -w apps/api

# ==========================================
# Production runtime stage
# ==========================================
FROM node:18-alpine AS runner
WORKDIR /app

# 👇 DON'T FORGET THIS: The production environment needs OpenSSL 1.1 too!
RUN apk add --no-cache openssl1.1-compat

COPY --from=base /app/package.json /app/package-lock.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/types ./packages/types
COPY --from=base /app/apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["npm", "start"]