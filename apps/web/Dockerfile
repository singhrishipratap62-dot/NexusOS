FROM node:20-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages ./packages

RUN pnpm install
RUN pnpm --filter @nexus/web... build

EXPOSE 3001
CMD ["pnpm", "--filter", "@nexus/web", "start"]
