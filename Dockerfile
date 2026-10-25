FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
# Build tools are only a fallback in case better-sqlite3 has no prebuilt binary for this platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Optional: an ArcGIS Location Platform key switches the map to Esri's basemap (baked in at build time).
ARG NEXT_PUBLIC_ARCGIS_API_KEY
# Optional: "true" turns on the AI assistant (baked in at build time).
ARG NEXT_PUBLIC_ASSISTANT_ENABLED
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_ARCGIS_API_KEY=$NEXT_PUBLIC_ARCGIS_API_KEY \
    NEXT_PUBLIC_ASSISTANT_ENABLED=$NEXT_PUBLIC_ASSISTANT_ENABLED \
    NODE_OPTIONS=--max-old-space-size=1280 \
    SKIP_BUILD_TYPECHECK=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/courts.db
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
