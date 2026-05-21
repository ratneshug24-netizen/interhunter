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

# ==========================================
# 👇 UPDATED PRODUCTION RUNTIME STAGE 👇
# ==========================================
FROM node:18-alpine AS runner
WORKDIR /app

# Copy the entire workspace metadata
COPY --from=base /app/package.json /app/package-lock.json ./

# Copy the entire root node_modules where npm hoists express and your dependencies
COPY --from=base /app/node_modules ./node_modules

# Copy the built application workspace folders
COPY --from=base /app/packages/types ./packages/types
COPY --from=base /app/apps/api ./apps/api

# Move straight into your API folder context
WORKDIR /app/apps/api
EXPOSE 3000

# Fire up the engine
CMD ["npm", "start"]