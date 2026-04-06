# Stage 1: Dependencies
FROM oven/bun:1 AS install
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Build
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=install /app/node_modules ./node_modules
COPY . .
ARG CONTROL_API_URL
ENV CONTROL_API_URL=${CONTROL_API_URL}
RUN bun run build

# Stage 3: Release
FROM oven/bun:1-slim AS release
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV NITRO_PRESET=bun
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["bun", "run", ".output/server/index.mjs"]