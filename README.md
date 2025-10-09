<h3 align="center">Skylite UX</h3>

<p align="center">
    The open-source family manager
</p>

<p align="center">
<img src="https://github.com/user-attachments/assets/cf4b4b9f-c8db-4303-8fd0-58126a42382f" alt="SkyLite-UX"/>
</p>

[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/KJn3YfWxn7)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docs.docker.com/get-started/get-docker/)
[![NUXT](https://img.shields.io/badge/Nuxt-00DC82?style=for-the-badge&logo=nuxt&logoColor=white)](https://nuxt.com/docs/getting-started/introduction)
[![NUXT UI](https://img.shields.io/badge/NuxtUI-00DC82?style=for-the-badge&logo=nuxt&logoColor=white)](https://ui.nuxt.com)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/docs/installation/using-vite)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/docs)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/docs/)

# About The Project

Skylite UX was conceived as an open source, self-hosted alternative to commercial family managers. Most commercial offerings require expensive hardware and include subscriptions. Our goal was to create an offering that allows you to bring your own hardware, avoid subscriptions, and subscription associated feature creep while playing nicely with other self-hosted offerings.

## Features

- Docker Deployment
- Family Calendar
- Task Lists
- Meal Planning
- User Management
- **Kiosk Mode** - Wall display for family calendars
- **PWA Support** - Offline-capable progressive web app
- **ICS Calendar Sync** - Import events from external ICS feeds (Phase 1)

## Installation

View the [docs](https://wetzel402.github.io/Skylite-UX-docs/index.html#installation) for details.

## Development

Read our [development guide](https://wetzel402.github.io/Skylite-UX-docs/DEVELOPMENT.html) for more details.

### API Endpoints

SkyLite-UX provides several API endpoints for calendar data and administration:

#### Events API

**GET /api/events/week** - Retrieve calendar events for a week
- **Authentication**: Requires `DISPLAY_TOKEN` (kiosk mode) or `ADMIN_API_TOKEN`
- **Query Parameters**:
  - `from` (optional): Start date in ISO format (defaults to current week start)
  - `to` (optional): End date in ISO format (defaults to current week end)
  - `token`: Display token for kiosk mode
- **Response**: Array of events with overlap predicate (start <= to AND end >= from)
- **Cache**: 15-second cache with `Cache-Control: public, max-age=15`
- **Features**: Excludes cancelled events, 500ms DB timeout, graceful error handling

```bash
# Kiosk mode (requires DISPLAY_TOKEN)
curl "http://localhost:3000/api/events/week?token=your-display-token"

# With custom date range
curl "http://localhost:3000/api/events/week?token=your-display-token&from=2025-01-01T00:00:00.000Z&to=2025-01-07T00:00:00.000Z"
```

#### Admin Endpoints

**GET /api/admin/sources** - List calendar sources
```bash
curl -H "X-Admin-Token: your-admin-token" http://localhost:3000/api/admin/sources
```

**POST /api/admin/sync** - Trigger manual sync
```bash
curl -X POST -H "X-Admin-Token: your-admin-token" http://localhost:3000/api/admin/sync
```

#### Environment Variables
- `ADMIN_API_TOKEN`: Required for admin endpoint access
- `ICS_FEEDS`: JSON array of ICS feed configurations
- `CALDAV_ACCOUNTS`: JSON array of CalDAV account configurations

### Bootstrapping Sources

Calendar sources are automatically bootstrapped from environment variables on server startup:

- **ICS Feeds**: Configured via `ICS_FEEDS` environment variable
- **CalDAV Accounts**: Configured via `CALDAV_ACCOUNTS` environment variable
- Sources are created with stable, deterministic IDs
- Existing sources are updated if configuration changes
- Passwords are never logged; usernames are masked in responses

### Local Database Quickstart

1. Start development PostgreSQL:
   ```bash
   npm run db:up
   ```

2. Run database migrations:
   ```bash
   npm run db:migrate
   ```

3. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the application:
   ```bash
   npm run dev
   ```

### Testing Locally

1. Start PostgreSQL:
   ```bash
   npm run db:up
   ```

2. Run database migrations:
   ```bash
   npm run db:migrate
   ```

3. Set up test environment:
   ```bash
   cp .env.test .env
   ```

4. Run tests:
   ```bash
   npm run test
   ```

### Admin Commands

Test the admin endpoints with curl:

```bash
# List calendar sources
curl -H "X-Admin-Token: test-admin" http://localhost:3000/api/admin/sources

# Trigger manual sync
curl -X POST -H "X-Admin-Token: test-admin" http://localhost:3000/api/admin/sync
```

### Troubleshooting Database 500 Errors

If you encounter database connection errors:

1. **Start the database**:
   ```bash
   npm run db:up
   ```

2. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

3. **Check environment variables**:
   ```bash
   # Ensure DATABASE_URL is set correctly
   echo $DATABASE_URL
   ```

4. **Test database connection**:
   ```bash
   npm run db:psql
   ```

5. **Run smoke test**:
   ```bash
   npm run smoke
   ```

### Database Management

- **Start database**: `npm run db:up`
- **Stop database**: `npm run db:down`
- **Run migrations**: `npm run db:migrate`
- **Connect to database**: `npm run db:psql`
- **Reset test database**: `make db-reset-test`

## Contributing

Check out the [contributor guide](https://wetzel402.github.io/Skylite-UX-docs/CONTRIBUTING.html) to get started.

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Special Thanks

The calendar UI was rewritten from [OriginUI](https://github.com/origin-space/ui-experiments) React code with express permission. Thank you Pasquale and Davide!
