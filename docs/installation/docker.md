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
- **develop** - Latest development build from main branch
- **YYYY.MM.Micro** - If you need a specific version you can specify the version number.

## Database Options

Skylite UX supports two database backends. **SQLite is the default** and recommended for most users.

### SQLite (Default - Recommended)

SQLite runs inside the same container - no external database needed. Perfect for:
- Single-user or family deployments
- Raspberry Pi or low-resource devices
- Simple self-hosted setups

Just mount a volume for persistent storage:

```bash
docker run -d \
  -p 3000:3000 \
  -v /path/to/data:/data \
  -e NUXT_PUBLIC_TZ=America/Chicago \
  --name skylite-ux \
  y3knik/skylite-ux:beta
```

Your database will be stored at `/path/to/data/skylite.db`.

### PostgreSQL (Optional)

If you prefer PostgreSQL for production or multi-user deployments, set the `DATABASE_URL` environment variable:

```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/skylite" \
  -e NUXT_PUBLIC_TZ=America/Chicago \
  --name skylite-ux \
  y3knik/skylite-ux:beta
```

---

## Quick Start with SQLite

The simplest way to get started:

```bash
# Create a directory for your data
mkdir -p ~/skylite-data

# Run Skylite UX
docker run -d \
  -p 3000:3000 \
  -v ~/skylite-data:/data \
  -e NUXT_PUBLIC_TZ=America/Chicago \
  --name skylite-ux \
  y3knik/skylite-ux:beta
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Docker Compose

### SQLite Version (Recommended)

```yaml
services:
  skylite-ux:
    image: y3knik/skylite-ux:beta
    restart: unless-stopped
    environment:
      - NUXT_PUBLIC_TZ=America/Chicago
      - NUXT_PUBLIC_LOG_LEVEL=warn
    volumes:
      - ./data:/data
    ports:
      - 3000:3000
```

### PostgreSQL Version

```yaml
services:
  skylite-ux:
    image: y3knik/skylite-ux:beta
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

---

## Configuration

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NUXT_PUBLIC_TZ` | Your timezone | `America/Chicago`, `Europe/London` |

### Database

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `file:/data/skylite.db` (SQLite) |
| `PRISMA_ACCEPT_DATA_LOSS` | Allow destructive schema changes on startup | `false` |

**DATABASE_URL formats:**

- **SQLite (default):** `file:/data/skylite.db` or `file:/custom/path/mydb.db`
- **PostgreSQL:** `postgresql://user:password@host:5432/dbname`

If `DATABASE_URL` is not set, SQLite is used with the default path `/data/skylite.db`.

**PRISMA_ACCEPT_DATA_LOSS:**

When set to `true`, allows Prisma to apply destructive schema changes automatically during startup. Only use this if you understand the risks of potential data loss during schema migrations.

```bash
-e PRISMA_ACCEPT_DATA_LOSS=true
```

### Application

| Variable | Description | Default |
|----------|-------------|---------|
| `NUXT_PUBLIC_LOG_LEVEL` | Logging level | `info` |

Valid log levels: `debug`, `info`, `warn`, `error`

### Google Calendar Integration

To enable Google Calendar integration, add these environment variables:

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret |

See the [Google Calendar integration documentation](/integrations/calendar/#google-calendar) for setup instructions.
