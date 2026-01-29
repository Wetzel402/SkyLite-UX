---
title: Docker
parent: Installation
layout: default
nav_order: 3
permalink: /installation/docker/
---

# Docker

## Tags

- **latest** (not currently implemented) - The default most recent release
- **beta** - Get a preview of the most recent features and bug fixes
- **YYYY.MM.Micro** - If you need a specific version you can specify the version number.

## Docker CLI

```bash
# Create a network
docker network create skylite-network

# Create a volume for PostgreSQL data
docker volume create postgres-data

# Run PostgreSQL
docker run -d \
  --name skylite-ux-db \
  --network skylite-network \
  -e POSTGRES_USER=skylite \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=skylite \
  -v postgres-data:/var/lib/postgresql/data \
  postgres:16

# Run Skylite UX
docker run -d \
  --name skylite-ux \
  --network skylite-network \
  -e DATABASE_URL=postgresql://skylite:password@skylite-ux-db:5432/skylite \
  -e NUXT_PUBLIC_TZ=America/Chicago \
  -e NUXT_PUBLIC_LOG_LEVEL=warn \
  -p 3000:3000 \
  wetzel402/skylite-ux:beta
```

## Docker Compose

```yaml
services:
  skylite-ux:
    image: wetzel402/skylite-ux:beta
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://skylite:password@skylite-ux-db:5432/skylite
      - NUXT_PUBLIC_TZ=America/Chicago
      - NUXT_PUBLIC_LOG_LEVEL=warn
    depends_on:
      skylite-ux-db:
        condition: service_healthy
    ports:
      - 3000:3000
    networks:
      - skylite-network

  skylite-ux-db:
    image: postgres:16
    restart: unless-stopped
    environment:
      - POSTGRES_USER=skylite
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=skylite
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: [CMD-SHELL, pg_isready -U skylite]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - skylite-network

networks:
  skylite-network:
    driver: bridge

volumes:
  postgres-data:
    driver: local
```

## Configuration

Make sure to update the following environment variables in your `docker-compose.yml`:

- `DATABASE_URL` - PostgreSQL connection string
- `NUXT_PUBLIC_TZ` - Your timezone (e.g., America/Chicago, Europe/London)
- `NUXT_PUBLIC_LOG_LEVEL` - Logging level (debug, info, warn, error)
- `POSTGRES_PASSWORD` - Choose a strong password for your database
