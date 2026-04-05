FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy only this app's package.json for dependency caching
COPY apps/discord-rp-server/package.json apps/discord-rp-server/

# Install dependencies (production + dev for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/discord-rp-server/ apps/discord-rp-server/

# Build TypeScript
RUN pnpm --filter @hesoyam/discord-rp-server build

# Production stage
FROM node:20-slim AS production
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/discord-rp-server/package.json apps/discord-rp-server/

RUN pnpm install --frozen-lockfile --prod

COPY --from=base /app/apps/discord-rp-server/dist apps/discord-rp-server/dist

WORKDIR /app/apps/discord-rp-server

CMD ["node", "dist/index.js"]
