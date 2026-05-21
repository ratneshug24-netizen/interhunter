# Base stage for dependencies
FROM node:18-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

# Copy root configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

# Copy all workspaces
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Install dependencies across the monorepo
RUN pnpm install --frozen-lockfile

# Step 1: Build the shared types package first
RUN pnpm --filter @internhunter/types build

# Step 2: Build the backend API server
WORKDIR /app/apps/api
RUN pnpm build

# Production runtime stage
FROM node:18-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm

COPY --from=base /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=base /app/packages/types/package.json ./packages/types/package.json
COPY --from=base /app/packages/types/dist ./packages/types/dist
COPY --from=base /app/apps/api/package.json ./apps/api/package.json
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/node_modules ./apps/api/node_modules

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["pnpm", "start"]