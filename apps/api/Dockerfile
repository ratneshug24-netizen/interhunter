# Base stage for dependencies
FROM node:18-alpine AS base
WORKDIR /app

# ADD THIS LINE
RUN apk add --no-cache openssl

COPY package.json package-lock.json tsconfig.json ./
COPY packages/types ./packages/types
COPY apps/api ./apps/api

RUN npm ci

ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
RUN npx prisma generate --schema=./apps/api/prisma/schema.prisma

RUN npm run build -w packages/types
RUN npm run build -w apps/api

FROM node:18-alpine AS runner
WORKDIR /app

# ADD THIS LINE
RUN apk add --no-cache openssl

ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

COPY --from=base /app/package.json /app/package-lock.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/types ./packages/types
COPY --from=base /app/apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 3000

CMD ["npm", "start"]