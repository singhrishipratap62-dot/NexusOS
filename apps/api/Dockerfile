FROM node:20-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN pnpm install
RUN pnpm --filter @nexus/api prisma:generate
RUN pnpm --filter @nexus/api... build

EXPOSE 3000
CMD ["pnpm", "--filter", "@nexus/api", "start"]
