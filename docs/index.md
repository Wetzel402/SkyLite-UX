---
title: Home
layout: default
nav_order: 1
permalink: /
---

![SkyLite-UX Logo](https://github.com/user-attachments/assets/cf4b4b9f-c8db-4303-8fd0-58126a42382f){: width="400" }

# Skylite UX

**Life, Organized.**

<div class="badges">
  <a href="https://discord.gg/KJn3YfWxn7">
    <img src="https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord" />
  </a>
  <a href="https://hub.docker.com/r/wetzel402/skylite-ux">
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  </a>
  <a href="https://nuxt.com/docs/getting-started/introduction">
    <img src="https://img.shields.io/badge/Nuxt-00DC82?style=for-the-badge&logo=nuxt&logoColor=white" alt="Nuxt" />
  </a>
  <a href="https://ui.nuxt.com">
    <img src="https://img.shields.io/badge/NuxtUI-00DC82?style=for-the-badge&logo=nuxt&logoColor=white" alt="NuxtUI" />
  </a>
  <a href="https://tailwindcss.com/docs/installation/using-vite">
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS" />
  </a>
  <a href="https://www.prisma.io/docs">
    <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  </a>
  <a href="https://www.postgresql.org/docs/">
    <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  </a>
</div>

## About

Skylite UX was conceived as an open source, self-hosted alternative to commercial family managers. Most commercial offerings require expensive hardware and include subscriptions. Our goal was to create an offering that allows you to bring your own hardware, avoid subscriptions, and subscription associated feature creep while playing nicely with other self-hosted offerings.

## Features

### Calendar

![Calendar Week View]({{ '/assets/images/screenshots/calendar_week_view.png' | relative_url }})

- View upcoming and past events for your family in the month, week, day, or agenda views
- Add, edit, or delete events
- Family-friendly event management

### To-do Lists

![Todo List]({{ '/assets/images/screenshots/todo.png' | relative_url }})

- Track to-do lists for family members
- Add, edit, or check items on your to-do lists
- Collaborative list management

### Shopping Lists

![Shopping List]({{ '/assets/images/screenshots/shopping.png' | relative_url }})

- Add, edit, or check items on your shopping lists
- Collaborative list management

### Meals (Not yet implemented)

- View upcoming and past meals for your family in the month, week, day or agenda views
- Add breakfast, lunch, dinner, and sides to your meal plan
- Edit or delete meals from your meal plan

### Users

![Settings Page]({{ '/assets/images/screenshots/settings.png' | relative_url }})

- Add, edit, or remove family members
- Assign family members a specific profile color
- Personalized family management

### Docker Deployment

Easy deployment with Docker

View all screenshots in our [Gallery]({{ '/gallery/' | relative_url }}) page.

## Installation

### Docker CLI

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
  wetzel402/skylite-ux:latest
```

### Docker Compose

```yaml
services:
  skylite-ux:
    image: wetzel402/skylite-ux:latest
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

### Configuration

Make sure to update the following environment variables in your `docker-compose.yml`:

- `DATABASE_URL` - PostgreSQL connection string
- `NUXT_PUBLIC_TZ` - Your timezone (e.g., America/Chicago, Europe/London)
- `NUXT_PUBLIC_LOG_LEVEL` - Logging level (debug, info, warn, error)
- `POSTGRES_PASSWORD` - Choose a strong password for your database

## Development

For detailed development setup, environment configuration, and workflow guidelines, see our [Development Guide]({{ '/development/' | relative_url }}).

### Prerequisites

- [Docker](https://docs.docker.com/get-started/get-docker/)
- [Visual Studio Code](https://code.visualstudio.com/)

### Quick Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run type checking
npm run type-check

# Lint code
npm run lint
```

## Contributing

We welcome contributions from the community! For detailed information on how to contribute, including our code of conduct, development process, and guidelines, see our [Contributing Guide]({{ '/contributing/' | relative_url }}).

### Quick Start for Contributors

1. **Fork the repository**
2. **Create your feature branch** from `dev`
3. **Make your changes** following our style guidelines
4. **Test your changes** thoroughly
5. **Submit a Pull Request**

### Ways to Contribute

- **Bug Reports** - Help us identify and fix issues
- **Feature Requests** - Suggest new features and improvements
- **Code Contributions** - Fix bugs and implement features
- **Documentation** - Improve docs and write tutorials
- **Testing** - Write tests and help with quality assurance

## License

Distributed under the MIT License. See [LICENSE](https://github.com/wetzel402/SkyLite-UX/blob/main/LICENSE.md) for more information.

## Special Thanks

The calendar UI was rewritten from [OriginUI](https://github.com/origin-space/ui-experiments) React code with express permission. Thank you Pasquale and Davide!
