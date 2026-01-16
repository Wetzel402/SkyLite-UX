<h3 align="center">Skylite-UX</h3>

<p align="center">
    Life, Organized.
</p>

<p align="center">
<img src="https://github.com/user-attachments/assets/cf4b4b9f-c8db-4303-8fd0-58126a42382f" alt="SkyLite-UX"/>
</p>

[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/KJn3YfWxn7)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://hub.docker.com/r/wetzel402/skylite-ux)
[![NUXT](https://img.shields.io/badge/Nuxt-00DC82?style=for-the-badge&logo=nuxt&logoColor=white)](https://nuxt.com/docs/getting-started/introduction)
[![NUXT UI](https://img.shields.io/badge/NuxtUI-00DC82?style=for-the-badge&logo=nuxt&logoColor=white)](https://ui.nuxt.com)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/docs/installation/using-vite)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/docs)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/docs/)

# About The Project

Skylite UX was conceived as an open source, self-hosted alternative to commercial family managers. Most commercial offerings require expensive hardware and include subscriptions. Our goal was to create an offering that allows you to bring your own hardware, avoid subscriptions, and subscription associated feature creep while playing nicely with other self-hosted offerings.

## Features

- **Family Calendar** - Two-way Google Calendar sync with multi-user support
- **Chores System** - Track chores with point values and parent verification
- **Rewards System** - Kids redeem earned points for rewards
- **Weather Integration** - Open-Meteo, OpenWeatherMap, or Home Assistant
- **Photo Screensaver** - Google Photos integration for idle display
- **Task Lists** - Columnar to-do lists with drag-and-drop
- **Shopping Lists** - Shared shopping lists with check-off
- **Meal Planning** - Integrations with Mealie and Tandoor
- **User Management** - Parent/child roles with permissions
- **Skylight-Inspired UI** - Bright pastel colors, touch-friendly design

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- (Optional) Google Cloud Console project for Calendar/Photos

### Development Setup

1. Clone the repository:

```bash
git clone https://github.com/wetzel402/SkyLite-UX.git
cd SkyLite-UX
```

2. Run the setup script:

```bash
chmod +x init.sh
./init.sh
```

Or manually:

```bash
npm install
cp .env.example .env  # Configure your settings
npx prisma generate
npx prisma migrate dev
npm run dev
```

3. Open http://localhost:3000

### Environment Variables

Create a `.env` file with:

```env
# Required
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/skylite?schema=public"

# Google Integration (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/integrations/google-calendar/oauth/callback"
OAUTH_ENCRYPTION_KEY=""  # Generate with: openssl rand -hex 32

# Optional
NUXT_PUBLIC_TZ="America/Chicago"
NUXT_PUBLIC_LOG_LEVEL="info"
```

## Development Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint with auto-fix
npm run format           # Format code with Prettier
npm run type-check       # Run TypeScript type checking
npx prisma studio        # Open Prisma database GUI
```

## Installation

View the [docs](https://wetzel402.github.io/Skylite-UX-docs/index.html#installation) for details.

## Development

Read our [development guide](https://wetzel402.github.io/Skylite-UX-docs/DEVELOPMENT.html) for more details.

## Contributing

Check out the [contributor guide](https://wetzel402.github.io/Skylite-UX-docs/CONTRIBUTING.html) to get started.

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Special Thanks

The calendar UI was rewritten from [OriginUI](https://github.com/origin-space/ui-experiments) React code with express permission. Thank you Pasquale and Davide!
