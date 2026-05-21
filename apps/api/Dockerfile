# Base stage for dependencies
FROM node:18-alpine AS base
WORKDIR /app

# Copy root configurations for npm workspaces
COPY package.json package-lock.json tsconfig.json ./

# Copy all workspaces/packages
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Install dependencies using npm workspaces
RUN npm ci

# Step 1: Build the shared types package first
RUN npm run build -w packages/types

# Step 2: Build the backend API server
RUN npm run build -w apps/api

# Production runtime stage
FROM node:18-alpine AS runner
WORKDIR /app

# Copy built artifacts and configurations from base stage
COPY --from=base /app/package.json /app/package-lock.json ./
COPY --from=base /app/packages/types/package.json ./packages/types/package.json
COPY --from=base /app/packages/types/dist ./packages/types/dist
COPY --from=base /app/apps/api/package.json ./apps/api/package.json
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/node_modules ./apps/api/node_modules

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["npm", "start"]