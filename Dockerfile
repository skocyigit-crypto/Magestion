# Image unique : sert l'API (tsx, pas de build JS distinct — @magestion/db
# exporte du TypeScript source, voir lib/db/package.json "exports") ET le
# front (build Vite statique) depuis le meme conteneur. Evite CORS et un
# second service Cloud Run a maintenir separement.
FROM node:24-slim

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY lib ./lib
COPY artifacts ./artifacts

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @magestion/web run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Migrations NON lancees au demarrage du conteneur (garde-fou volontaire dans
# migrate.ts : refuse de tourner en NODE_ENV=production sans
# ALLOW_PROD_MIGRATIONS=1 explicite — evite un crash-loop silencieux si une
# migration echoue au boot). A appliquer manuellement avant chaque deploiement
# qui en introduit de nouvelles : DATABASE_URL=... pnpm --filter @magestion/db run migrate
CMD ["pnpm", "--filter", "@magestion/api-server", "run", "prod"]
