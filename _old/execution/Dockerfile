FROM oven/bun:1

WORKDIR /app

# Install dependencies for OpenCode
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install OpenCode
RUN curl -fsSL https://opencode.ai/install | bash

# Add OpenCode to PATH
ENV PATH="/root/.opencode/bin:${PATH}"

# Verify OpenCode installation
RUN opencode --version

# Create working directory for tasks
RUN mkdir -p /projects

# Copy package files
COPY package.json .
COPY apps/execution/package.json ./apps/execution/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/types/package.json ./packages/types/

# Install dependencies
RUN bun install

# Copy source code
COPY apps/execution ./apps/execution
COPY packages/tsconfig ./packages/tsconfig
COPY packages/types ./packages/types
COPY turbo.json ./

WORKDIR /app/apps/execution

CMD ["bun", "run", "src/index.ts"]
