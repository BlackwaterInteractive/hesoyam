FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy only this app's package.json for dependency caching
COPY apps/backend/package.json apps/backend/

# Install dependencies (production + dev for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/backend/ apps/backend/

# Build
RUN pnpm --filter backend build

# Production stage
FROM node:20-slim AS production
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/

RUN pnpm install --frozen-lockfile --prod

COPY --from=base /app/apps/backend/dist apps/backend/dist

WORKDIR /app/apps/backend

EXPOSE 3000

CMD ["node", "dist/main"]
