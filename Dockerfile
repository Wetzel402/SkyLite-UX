# syntax=docker/dockerfile:1

# Build stage
FROM --platform=$BUILDPLATFORM dhi.io/node:20-debian13-dev AS builder

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install system dependencies and npm packages
RUN apt-get update -y && apt-get install -y openssl && \
    npm ci && \
    rm -rf /var/lib/apt/lists/*

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM dhi.io/node:20-debian13-dev AS production

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Set working directory
WORKDIR /app

# Copy prisma directory for migrations
COPY prisma ./prisma/

# Copy package-lock.json to extract Prisma version
COPY package-lock.json ./package-lock.json

# Install system dependencies and Prisma CLI
RUN apt-get update -y && apt-get install -y openssl && \
    PRISMA_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version") && \
    npm install -g prisma@${PRISMA_VERSION} && \
    rm package-lock.json && \
    rm -rf /var/lib/apt/lists/*

# Copy built application from builder stage
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Expose the port the app runs on
EXPOSE 3000

# Initialize database and start application
CMD ["sh", "-c", "npx prisma migrate deploy && node .output/server/index.mjs"]
