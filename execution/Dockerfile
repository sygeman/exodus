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

COPY package.json .
RUN bun install

COPY . .

CMD ["bun", "run", "src/index.ts"]
