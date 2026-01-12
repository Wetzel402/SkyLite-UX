---
title: Development Guide
layout: default
nav_order: 3
permalink: /development/
---

# Development Guide

Welcome to the Skylite UX development guide! This document will help you set up your development environment and understand the project structure.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Docker](https://docs.docker.com/get-started/get-docker/)
- [Visual Studio Code](https://code.visualstudio.com/)

## Quick Start

- Fork the repo and create your feature branch from `dev`.
- Install [Docker](https://docs.docker.com/get-started/get-docker/)
- Install [Visual Studio Code](https://code.visualstudio.com/)
- In VS Code [open the command palette and select](https://code.visualstudio.com/docs/devcontainers/containers#_quick-start-open-a-git-repository-or-github-pr-in-an-isolated-container-volume) `Dev Containers: Clone Repository in Container Volume`. Select your repository and branch.
- Start the development server on `http://localhost:3000` with:

```bash
npm run dev
```

## Project Structure

```
Skylite-UX/
├── .devcontainer/              # Dev container configuration
│   └── integrations/           # Compose files to deploy integration containers
├── app/                        # Main application code
│   ├── assets/                 # Static assets (CSS, images, etc.)
│   ├── components/             # Vue components
│   │   ├── calendar/           # Calendar-related components
│   │   ├── global/             # Global/shared components
│   │   ├── settings/           # Settings page components
│   │   ├── shopping/           # Shopping list components
│   │   └── todos/              # Todo list components
│   ├── composables/            # Vue composables
│   ├── integrations/           # Client-side integration configuration and service implementations (iCal, Mealie, etc.)
│   ├── lib/                    # Library configuration files and singleton instances (e.g., Prisma client)
│   ├── pages/                  # Application pages (auto-routed)
│   ├── plugins/                # Nuxt plugins
│   ├── types/                  # TypeScript type definitions
│   ├── app.config.ts           # App configuration
│   └── app.vue                 # Root Vue component
├── docs/                       # Github Docs page with detailed documentation
├── prisma/                     # Database schema and migrations
│   ├── migrations/             # Database migration files
│   └── schema.prisma           # Prisma schema definition
├── public/                     # Public static assets
├── server/                     # Server-side code
│   ├── api/                    # API endpoints
│   │   ├── calendar-events     # Calendar event CRUD API endpoints
│   │   ├── integrations/       # Integration CRUD API endpoints and proxy routes for external services
│   │   ├── shopping-list-items # Shopping list item CRUD and reordering API endpoints
│   │   ├── shopping-lists/     # Shopping list CRUD, reordering, and item management API endpoints
│   │   ├── sync                # Real-time synchronization API endpoints (register, events, status, trigger)
│   │   ├── todo-columns        # Todo column (Kanban) CRUD and reordering API endpoints
│   │   ├── todos/              # Todo CRUD and reordering API endpoints
│   │   └── users/              # User CRUD and reordering API endpoints
│   ├── integrations            # Server-side integration service implementations (iCal, Mealie, etc.)
│   ├── plugins/                # Server plugins
│   └── utils/                  # Server-side utility functions and helpers (rrule parsing, sanitization, etc.)
├── docker-compose-example.yaml # Example docker compose file
├── Dockerfile                  # Dockerfile to build Skylite-UX
├── eslint.config.mjs           # ESLint configuration
├── LICENSE.md                  # Project license
├── nuxt.config.ts              # Nuxt configuration
├── package.json                # Dependencies and scripts
├── README.md                   # Project documentation
└── tsconfig.json               # TypeScript configuration
```

## Development Workflow

### 1. Branch Strategy

- **main**: Production-ready code
- **dev**: Development branch (default for PRs)
- **feature/\***: New features
- **bugfix/\***: Bug fixes
- **hotfix/\***: Critical production fixes

### 2. Development Process

1. **Create a branch**

   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code following the style guide
   - Add tests for new features
   - Update documentation (if required)

3. **Test your changes**

   ```bash
   npm run test
   npm run lint
   npm run type-check
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

5. **Push and create PR**

   ```bash
   git push origin feature/your-feature-name
   # Create Pull Request to dev branch
   ```

### 3. Code Style

All linting rules are defined in eslint.config.mjs.

#### File Naming Conventions

The project uses a camelCase naming convention for all files with some exceptions such as API routes and docker compose files where kebab-case is the convention.

#### Vue & TypeScript Guidelines

- Use `<script setup lang="ts">` for all components
- Define proper TypeScript types and interfaces
- Leverage Nuxt auto-imports (no need to import `ref`, `computed`, etc.)
- Use `defineProps` and `defineEmits` with TypeScript generics
- Avoid `any` type - use proper typing or `unknown`

#### Styling Guidelines

- Use Tailwind CSS utility classes for styling
- Leverage Nuxt UI components when available
- Follow mobile-first responsive design approach
- Use consistent spacing and color tokens

#### Code Quality

- Run `npm run lint` before committing
- Run `npm run type-check` to catch TypeScript errors
- Write meaningful variable and function names
- Keep functions small and focused on a single responsibility
- Follow conventional commits format (e.g., `feat:`, `fix:`, `docs:`)

## Integrations

Skylite-UX is designed to integrate with various external and self-hosted services. This section covers how to set up and configure integrations for development.

We use the [docker outside of docker](https://github.com/devcontainers/features/pkgs/container/features%2Fdocker-outside-of-docker) dev container feature for easier development.

### Integration Development

#### For Self-Hosted Integrations:

1. **Create a new folder** in `Skylite-UX/.devcontainer/integrations/`
2. **Create a Docker Compose file** for the new service you are integrating (see [Docker Compose for Integrations](#docker-compose-for-integrations))
3. **Spin up the Docker container**
4. **Generate an API key** for the service (if applicable)

#### For External Integrations:

1. **Obtain API credentials or OAuth credentials** for the external service (if applicable)

#### Code Implementation (All Integration Types):

1. **Add a new folder** in `Skylite-UX/app/integrations/` (e.g., `app/integrations/myService/`)
2. **Create your client-side integration file** (e.g., `myServiceShoppingLists.ts`, `myServiceCalendar.ts`)
3. **Add a new folder** in `Skylite-UX/server/integrations/` (e.g., `server/integrations/myService/`)
4. **Create your server-side service files** (`client.ts`, `index.ts`, `types.ts`, etc.)
5. **(Optional) Add a new folder** in `Skylite-UX/server/api/integrations/` if you need proxy API endpoints
6. **(Optional) Create API endpoint file(s)** (e.g., `[...path].ts` for proxy routes) if needed
7. **Add your service** in `Skylite-UX/app/integrations/integrationConfig.ts`:
   - Import your service factory function(s) at the top of the file
   - Add an entry to the `integrationConfigs` array with your integration configuration
   - Add your service factory to the `serviceFactoryMap` object using the key `${type}:${service}`
   - **(Optional) Add field filter** to the `fieldFilters` object if needed for shopping integrations
8. **Restart the application** to load the new integration configuration (the config is read at startup)
9. **Add the service in Skylite** via Settings > Integrations > Add Integration (the integration will now appear in the list)
10. **Test and commit** as defined in the [Development Workflow](#development-workflow)

### Integration Configuration

#### Docker Compose for Integrations

```yaml
# .devcontainer/integrations/service/service-docker-compose.yml
services:
  # Notes about the integration
  # How to create API key, base URL, etc.
  # Base URL: e.g. http://mealie:9000
  mealie:
    image: ghcr.io/mealie-recipes/mealie:latest
    container_name: mealie
    restart: always
    ports:
      - "9925:9000" # External port mapping
    deploy:
      resources:
        limits:
          memory: 1000M # Memory limit
    volumes:
      - mealie-data:/app/data/
    environment:
      # Set Backend ENV Variables Here
      ALLOW_SIGNUP: false
      PUID: 1000
      PGID: 1000
      TZ: America/Anchorage
    # Make sure the service runs on the same network as the dev container
    networks:
      skylite-ux_devcontainer_default:

volumes:
  mealie-data:

# Make sure the service runs on the same network as the dev container
networks:
  skylite-ux_devcontainer_default:
    external: true
```

#### Defining Your Integration in integrationConfig.ts

```typescript
// 1. Import your service factory function(s) at the top of integrationConfig.ts
import { createTandoorService, getTandoorFieldsForItem } from "./tandoor/tandoorShoppingLists";

// 2. Add your integration config entry to the integrationConfigs array
export const integrationConfigs: IntegrationConfig[] = [
  {
    type: "shopping", // calendar,todo,shopping,meal
    service: "tandoor", // the name of the service you are integrating
    settingsFields: [
      // fields used for setting up the integration
      {
        key: "apiKey",
        label: "API Key",
        type: "password" as const,
        placeholder: "Scope needs to be \"read write\"",
        required: true,
        description: "Your Tandoor API key for authentication"
      },
      {
        key: "baseUrl",
        label: "Base URL",
        type: "url" as const,
        placeholder: "http://your-tandoor-instance:port",
        required: true,
        description: "The base URL of your Tandoor instance"
      }
    ],
    capabilities: ["add_items", "edit_items"], // declare your capabilities
    icon: "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/tandoor-recipes.svg", // icon URL from selfh.st/icons
    dialogFields: [
      // fields used for dialog
      {
        key: "name",
        label: "Item Name",
        type: "text" as const,
        placeholder: "Milk, Bread, Apples, etc.",
        required: true,
        canEdit: true,
      },
      {
        key: "quantity",
        label: "Quantity",
        type: "number" as const,
        min: 0,
        canEdit: true,
      },
      {
        key: "unit",
        label: "Unit",
        type: "text" as const,
        placeholder: "Disabled for Tandoor",
        canEdit: false,
      },
    ],
    // time in minutes to sync the integration
    syncInterval: 5,
  },
];

// 3. Add your service factory to the serviceFactoryMap object
const serviceFactoryMap = {
  "calendar:iCal": createICalService, // existing entry
  "calendar:google": createGoogleCalendarService, // existing entry
  "shopping:mealie": createMealieService, // existing entry
  "shopping:tandoor": createTandoorService, // Add your factory function here
} as const;

// 4. (Optional) Add field filter for shopping integrations
const fieldFilters = {
  mealie: getMealieFieldsForItem,
  tandoor: getTandoorFieldsForItem, // Add your field filter function here if needed
};
```

### Troubleshooting Integrations

#### Common Issues

##### Authentication Errors

```bash
# Ensure service is on the same Docker network as dev container
# Ensure correct base URL
# Check token expiration
```

##### Data Sync Issues

```bash
# Check network connectivity
# Verify API endpoints
# Review error logs
# Test with minimal data set
```

## Testing (Not yet implimented)

Skylite-UX uses [@nuxt/test-utils](https://nuxt.com/docs/4.x/getting-started/testing) for comprehensive testing support, including both unit and end-to-end tests.

## Running

### Development Server

Start the development server with hot module replacement (HMR):

```bash
npm run dev
```

The development server will start on `http://localhost:3000` and automatically reload when you make changes to your code.

**Note:** The development server should start automatically after the dev container is created. You can manually start it with the command above if needed.

### Stopping the Server

Press `Ctrl+C` in the terminal where the server is running to stop it.

## Building

### Development Build

```bash
npm run build:dev
```

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Docker Build

**Note:** The Dockerfile uses `dhi.io/node:20` as the base image, which requires Docker Hub authentication. You must log into Docker Hub before building to ensure you use the same base image as production builds.

```bash
# Login to Docker Hub (required for base image authentication)
docker login

# Build Docker image (uses dhi.io/node:20, same as production)
docker build -t skylite-ux .

# Run Docker container
docker run -p 3000:3000 skylite-ux
```

Using the authenticated base image ensures consistency between local development builds and production builds, avoiding any potential differences between public and authenticated images.

## Documentation

The documentation site for SkyLite UX is built with Jekyll and hosted on GitHub Pages. This section covers how to test and work with the documentation locally using the devcontainer.

### Prerequisites

Ruby and Bundler are pre-installed in the devcontainer, and Jekyll dependencies are automatically installed when the container is created via the `postCreateCommand`. No manual installation is required.

### Installing Dependencies

Jekyll dependencies are automatically installed when the devcontainer is created. If you need to reinstall them (for example, after updating the `Gemfile`), navigate to the `docs` directory and run:

```bash
cd docs
bundle install
```

This will install Jekyll and all required dependencies as specified in the `Gemfile` to `vendor/bundle` (no sudo required).

### Running the Local Server

Start the Jekyll development server:

```bash
bundle exec jekyll serve --host 0.0.0.0
```

The `--host 0.0.0.0` flag is important in the devcontainer so that the server is accessible from outside the container. The documentation site will be available at `http://localhost:4000/SkyLite-UX/` (port forwarding should be configured automatically). Jekyll will automatically regenerate the site when you make changes to Markdown files.

### Making Changes

1. Edit any `.md` file in the `docs/` directory
2. Save your changes
3. The site will automatically rebuild (watch for changes in the terminal)
4. Refresh your browser to see the updates

### Stopping the Server

Press `Ctrl+C` in the terminal where the server is running to stop it.

### Note on GitHub Pages

GitHub Pages will automatically build and deploy the documentation site when you push changes to the repository. You don't need Ruby or Jekyll installed on your local machine - everything runs in the devcontainer for local testing.

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

#### Node Modules Issues

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Docker Issues

```bash
# Clean up Docker containers
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

#### TypeScript Errors

```bash
# Check TypeScript configuration
npm run type-check

# Regenerate TypeScript types
npm run types:generate
```

### Getting Help

- Check the [Issues](https://github.com/wetzel402/Skylite-UX/issues) page
- Search existing discussions
- Create a new issue with detailed information
- Join our [Discord](https://discord.gg/KJn3YfWxn7)

## Additional Resources

- [Nuxt 4 Documentation](https://nuxt.com/docs)
- [Nuxt UI Documentation](https://ui.nuxt.com)
- [Vue 3 Documentation](https://vuejs.org/guide/introduction.html)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
