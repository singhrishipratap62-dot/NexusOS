FROM node:20-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/workers ./apps/workers
COPY apps/api/prisma ./apps/api/prisma
COPY packages ./packages

RUN pnpm install
RUN pnpm --filter @nexus/workers exec prisma generate --schema ../api/prisma/schema.prisma
RUN pnpm --filter @nexus/workers... build

CMD ["pnpm", "--filter", "@nexus/workers", "start"]
