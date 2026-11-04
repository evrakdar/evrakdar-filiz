# API image (NestJS + Prisma). Build from the repository root:
#   docker build -f docker/api.Dockerfile -t evrakdar-api .
# Nothing in this image reports to an outside service, including the tools it runs.
FROM node:22-alpine AS build
WORKDIR /app
ENV CHECKPOINT_DISABLE=1 NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --ignore-scripts --workspace @evrakdar/api --workspace @evrakdar/shared
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm --workspace @evrakdar/api run prisma:generate \
  && npm --workspace @evrakdar/api run build

FROM node:22-alpine AS runtime
WORKDIR /app/apps/api
ENV NODE_ENV=production CHECKPOINT_DISABLE=1 NPM_CONFIG_UPDATE_NOTIFIER=false
RUN addgroup -S app && adduser -S app -G app && mkdir -p /data/files && chown -R app:app /data
COPY --from=build --chown=app:app /app /app
USER app
EXPOSE 3001
# Apply pending migrations, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
