# syntax=docker/dockerfile:1

# Build stage
FROM --platform=$BUILDPLATFORM node:20 AS builder

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install system dependencies and npm packages
RUN apt-get update -y && apt-get install -y openssl && \
    npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM --platform=$TARGETPLATFORM node:20 AS production

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install system dependencies and production npm packages
RUN apt-get update -y && apt-get install -y openssl && \
    npm ci --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Generate Prisma client in production
RUN npx prisma generate

# Expose the port the app runs on
EXPOSE 3000

# Initialize database and start application
CMD npx prisma migrate deploy && node .output/server/index.mjs