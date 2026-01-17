---
title: Code
parent: Contributing
layout: default
nav_order: 7
permalink: /contributing/code/
---

# Code

Welcome to the Skylite UX development guide! This document will help you set up your development environment and understand the project structure.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Docker](https://docs.docker.com/get-started/get-docker/)
- [Visual Studio Code](https://code.visualstudio.com/)

## Quick Start

- Fork the repository and create your feature branch from `dev`.
- Install [Docker](https://docs.docker.com/get-started/get-docker/)
- Install [Visual Studio Code](https://code.visualstudio.com/)
- In VS Code [open the command palette and select](https://code.visualstudio.com/docs/devcontainers/containers#_quick-start-open-a-git-repository-or-github-pr-in-an-isolated-container-volume) `Dev Containers: Clone Repository in Container Volume`. Select your repository and branch.
- Start the development server on `http://localhost:3000` with:

```bash
npm run dev
```

## Environment Variables

### Development Setup

- Default values are configured in `nuxt.config.ts`
- `DATABASE_URL` is automatically configured by the dev container

### Environment Variables

- `DATABASE_URL` (production only) - PostgreSQL connection string format: `postgresql://user:password@host:port/database`. In development, this is handled automatically by the dev container.
- `NUXT_PUBLIC_TZ` (optional) - Timezone. Default: `America/Chicago` Examples: `America/Chicago`, `Europe/London`, `Asia/Tokyo`
- `NUXT_PUBLIC_LOG_LEVEL` (optional) - Logging level. Default: `info` Options: `debug`, `info`, `warn`, `error`, `verbose`

**Note:** For production deployments, these environment variables must be set in your Docker Compose file or deployment configuration. See the [Docker installation]({{ '/installation/docker/' | relative_url }}) for production setup examples.

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
├── Dockerfile                  # Dockerfile to build Skylite UX
├── eslint.config.mjs           # ESLint configuration
├── LICENSE.md                  # Project license
├── nuxt.config.ts              # Nuxt configuration
├── package.json                # Dependencies and scripts
├── README.md                   # Project documentation
└── tsconfig.json               # TypeScript configuration
```

## API Documentation

Skylite UX uses Nuxt's file-based API routing system. API endpoints are automatically generated from files in the `server/api/` directory.

### API Endpoint Groups

- `/api/users` - User CRUD operations
- `/api/todos` - Todo CRUD and reordering
- `/api/todo-columns` - Todo column (Kanban) CRUD
- `/api/calendar-events` - Calendar event CRUD
- `/api/shopping-lists` - Shopping list CRUD
- `/api/shopping-list-items` - Shopping list item CRUD
- `/api/integrations` - Integration management
- `/api/sync` - Real-time synchronization

### API Conventions

- Endpoints use RESTful conventions: GET for read operations, POST for create/update operations
- API routes are auto-generated from files in `server/api/`
- See the [Project Structure](#project-structure) section above for the exact location of each endpoint group

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
   # npm run test (not currently implemented)
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

## AI-Assisted Code

We welcome contributions that use AI-assisted development tools (such as GitHub Copilot, ChatGPT, Cursor, etc.). However, all contributors are responsible for ensuring their code meets our standards.

### Contributor Responsibility

You are fully accountable for all code you submit, regardless of whether it was generated by AI tools. This means:

- Review and understand all AI-generated code before submission
- Ensure the code meets our quality and security standards
- Verify that you have the right to contribute the code
- Test and validate AI-generated code thoroughly

### Code Quality and Security

AI-generated code must meet the same standards as human-written code:

- Follow all project style guidelines (see [Code Style](#3-code-style) above)
- Pass linting and type-checking
- Include appropriate error handling
- Be maintainable and well-documented
- Meet security best practices

### Licensing and Attribution

Ensure that AI-generated code does not introduce license conflicts:

- Verify compatibility with the project's open source license
- Ensure no plagiarism of third-party copyrighted works
- Confirm that AI tool terms of service don't conflict with our license
- Ensure you have the right to contribute the code

### Review Process

AI-assisted contributions undergo the same review process as all other code:

- Must pass all code quality checks
- Subject to the same review standards
- May be rejected if they don't meet quality, licensing, etc
- Maintainers will evaluate based on the code itself, not its origin

### Best Practices

When using AI tools:

- Don't rely solely on AI-generated code without review
- Always review, test, and validate AI-generated code
- Ensure you understand what the code does before submitting
- Use AI tools as assistants, not replacements for your judgment
- Apply the same care and attention as you would to manually written code

## Testing (Not currently implemented)

Skylite UX uses [@nuxt/test-utils](https://nuxt.com/docs/4.x/getting-started/testing) for comprehensive testing support, including both unit and end-to-end tests.

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

Release builds utilize the [CalVer](https://calver.org) YYYY.MM.Micro standard.

**Note:** This project uses [Docker Hardened Images](https://www.docker.com/products/hardened-images/) for our base image, which requires Docker Hub authentication. You must log into Docker Hub before building to ensure you use the same base image as production builds.

```bash
# Login to Docker Hub (required for base image authentication)
docker login

# Build Docker image (uses dhi.io/node:20, same as production)
docker build -t skylite-ux .

# Run Docker container
docker run -p 3000:3000 skylite-ux
```

Using the authenticated base image ensures consistency between local development builds and production builds, avoiding any potential differences between public and authenticated images.

## Debugging

### Logging with Consola

Skylite UX uses [Consola](https://github.com/unjs/consola) for server-side logging. You can control the log level using the `NUXT_PUBLIC_LOG_LEVEL` environment variable.

**Log Levels:**

- `debug` - Detailed debugging information
- `info` - General informational messages (default)
- `warn` - Warning messages
- `error` - Error messages only
- `verbose` - Very detailed logging

**Example:**

```typescript
import consola from "consola";

consola.info("This is an info message");
consola.debug("This is a debug message");
consola.error("This is an error message");
```

### Client-Side Debugging

- **Browser DevTools** - Use the browser's built-in developer tools for inspecting elements, console logs, and network requests
- **Nuxt DevTools** - Enabled automatically in dev mode (client-side). Access via the Nuxt DevTools icon in your browser
- **Vue DevTools** - Install the [Vue DevTools browser extension](https://devtools.vuejs.org/) for advanced Vue component inspection

### Server-Side Debugging

- **Console Logging** - Use `consola` in server routes for logging:

  ```typescript
  import consola from "consola";

  consola.debug("Server route executed");
  ```

- **Prisma Studio** - Run `npx prisma studio` to open a visual database browser (typically available at `http://localhost:5555`). This allows you to view and edit database records directly.

### Common Debugging Scenarios

- **API endpoint not responding** - Check server logs in the terminal, verify the endpoint file exists in `server/api/`, and check the Network tab in browser DevTools
- **Database connection issues** - Verify `DATABASE_URL` is set correctly (in production) or that the dev container database is running
- **Type errors** - Run `npm run type-check` to identify TypeScript errors, ensure Prisma client is generated with `npx prisma generate` after schema changes

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

# Regenerate Prisma types (run after schema changes)
npx prisma generate
```

## Recognition

Contributors will be recognized in several ways:

- **Release notes** for significant contributions
- **Special thanks** for major contributions
- **Maintainer status** for consistent contributors
