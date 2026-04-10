# Stage 1: Dependencies
FROM oven/bun:1 AS install
WORKDIR /app
COPY package.json ./
COPY apps/ui/package.json ./apps/ui/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/types/package.json ./packages/types/
RUN bun install

# Stage 2: Build
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=install /app/node_modules ./node_modules
COPY --from=install /app/apps/ui/node_modules ./apps/ui/node_modules
COPY apps/ui ./apps/ui
COPY packages/tsconfig ./packages/tsconfig
COPY packages/types ./packages/types
COPY turbo.json ./
ARG CONTROL_API_URL
ENV CONTROL_API_URL=${CONTROL_API_URL}
WORKDIR /app/apps/ui
RUN bun run build

# Stage 3: Release
FROM oven/bun:1-slim AS release
WORKDIR /app
COPY --from=build /app/apps/ui/.output ./.output
ENV NITRO_PRESET=bun
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["bun", "run", ".output/server/index.mjs"]
