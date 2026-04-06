FROM oven/bun:1

WORKDIR /app

# Install git for repository operations
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create projects directory
RUN mkdir -p /data/projects

COPY package.json .
RUN bun install

COPY . .

CMD ["bun", "run", "src/index.ts"]