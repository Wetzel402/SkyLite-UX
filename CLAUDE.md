# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SkyLite-UX is an **open-source alternative to Skylight Calendar**, the commercial smart calendar device for families. This project aims to replicate Skylight's functionality and theming as a self-hosted web application, eliminating the need for expensive proprietary hardware and subscriptions.

**Key Goals**:

- Provide similar visual design and user experience to Skylight Calendar
- Support family-oriented features: shared calendar, task lists, shopping lists, meal planning
- Enable self-hosting with bring-your-own-hardware approach
- Integrate with existing services (iCal, Mealie, Tandoor) rather than lock users into an ecosystem
- Avoid subscription-based feature creep

Built with Nuxt 4, Vue 3, and TypeScript, designed for deployment on any hardware that can run Docker.

## Key Technologies

- **Frontend**: Nuxt 4 + Vue 3 + TypeScript
- **UI**: Nuxt UI + TailwindCSS
- **Database**: PostgreSQL with Prisma ORM
- **Logging**: Consola (configured globally via runtime config)
- **Deployment**: Docker-based

## Common Commands

### Development

```bash
npm run dev              # Start development server
npm run build           # Build for production
npm run preview         # Preview production build
```

### Code Quality

```bash
npm run lint            # Run ESLint with auto-fix
npm run format          # Format code with Prettier
npm run type-check      # Run TypeScript type checking
```

### Database

```bash
npx prisma migrate dev           # Create and apply migrations
npx prisma migrate deploy        # Apply migrations in production
npx prisma generate              # Generate Prisma client
npx prisma studio               # Open Prisma Studio GUI
```

## Architecture

### Nuxt 4 Structure

This project uses Nuxt 4's file-based architecture with the `app/` directory:

- **app/pages/**: File-based routing (index, calendar, toDoLists, shoppingLists, mealPlanner, settings)
- **app/components/**: Auto-imported Vue components organized by feature (calendar/, todos/, shopping/, settings/, global/)
- **app/composables/**: Auto-imported composables for shared logic
- **app/plugins/**: Plugin initialization order matters (01.logging → 02.appInit → 03.syncManager)
- **app/types/**: Shared TypeScript types
- **server/**: Nitro server with API routes and plugins

### Server-Side Architecture

**API Routes**: File-based routing in `server/api/`

- RESTful structure: `[id].get.ts`, `[id].put.ts`, `[id].delete.ts`, `index.post.ts`
- Nested routes: `shopping-lists/[id]/items.post.ts`
- Special endpoints: `reorder.put.ts` for drag-and-drop, `clear-completed.post.ts`

**Server Plugins**: Loaded in order (defined in `nuxt.config.ts`)

1. `01.logging.ts` - Configures consola log level from runtime config
2. `02.syncManager.ts` - Manages integration sync intervals and SSE broadcasting

### Integration System

The integration system supports external services with a flexible plugin architecture:

**Integration Types**:

- `calendar`: Calendar event sources (iCal)
- `shopping`: Shopping list integrations (Mealie, Tandoor)
- `todo`: Task list integrations

**Key Files**:

- `app/integrations/integrationConfig.ts`: Central registry of all integrations
- `app/types/integrations.ts`: Type definitions and service interfaces
- `server/integrations/`: Server-side integration implementations
- Each integration has: `client.ts`, `index.ts`, `types.ts`

**Sync Manager**: Server plugin that:

- Polls enabled integrations at configured intervals
- Broadcasts updates to connected clients via Server-Sent Events (SSE)
- Manages client connections and cleanup
- See `server/plugins/02.syncManager.ts` and `app/composables/useSyncManager.ts`

### Database Schema

Managed by Prisma (`prisma/schema.prisma`). Key models:

- **User**: User profiles with colors, ordered list display
- **TodoColumn**: Columnar task organization with user assignments
- **Todo**: Tasks with priority, due dates, completion status
- **ShoppingList** + **ShoppingListItem**: Shopping lists with quantity/unit tracking
- **CalendarEvent** + **CalendarEventUser**: Events with multi-user assignments
- **Integration**: External service configurations

**Prisma Client**: Singleton instance at `app/lib/prisma.ts` shared between client and server.

### State Management

No Pinia stores - uses Nuxt composables pattern instead:

- `useCalendarEvents()`, `useTodos()`, `useShoppingLists()`, etc.
- `useSyncManager()` handles real-time updates from integrations
- `useGlobalLoading()` for app-wide loading states
- `useAlertToast()` for notifications

### Timezone Handling

- All timestamps stored in UTC in the database
- Global timezone configured via `NUXT_PUBLIC_TZ` environment variable (default: `America/Chicago`)
- Convert to/from UTC using the global TZ when displaying or saving timestamps

### Component Patterns

**Global Components**: Statically imported in `app.vue` to avoid chunking issues:

- `globalAppLoading.vue`
- `globalSideBar.vue`
- `globalDock.vue`

**View Components**: Reusable views for different calendar modes:

- `globalAgendaView.vue`, `globalDayView.vue`, `globalWeekView.vue`, `globalMonthView.vue`

**Dialog Pattern**: Feature-specific dialogs for CRUD operations:

- `*Dialog.vue` components handle create/edit modals
- Use Nuxt UI's `UModal` component

## Configuration

### Runtime Config

Configured in `nuxt.config.ts`:

- `skyliteVersion`, `nuxtVersion`, `nuxtUiVersion`: Version display
- `logLevel`: Consola log level (default: "info", override with `NUXT_PUBLIC_LOG_LEVEL`)
- `tz`: Timezone (default: "America/Chicago", override with `NUXT_PUBLIC_TZ`)

### Environment Variables

Required:

- `DATABASE_URL`: PostgreSQL connection string

Optional:

- `NUXT_PUBLIC_LOG_LEVEL`: Set consola log level (trace, debug, info, warn, error)
- `NUXT_PUBLIC_TZ`: Set timezone for timestamp display

### ESLint Configuration

Lint rules in `eslint.config.mjs`:

- Uses `@antfu/eslint-config` with customizations
- Double quotes and semicolons required
- camelCase filenames enforced (exceptions for special files)
- `no-console` warns (use consola instead)
- `node/no-process-env` errors (use runtime config)
- Auto-sorts imports

## Development Practices

### Design Philosophy

When implementing UI features, aim to match the visual style and UX patterns of Skylight Calendar:

- Clean, family-friendly interface optimized for touchscreen/tablet display
- Large, easily tappable UI elements suitable for wall-mounted displays
- Calendar-centric design with clear day/week/month/agenda views
- User color coding for multi-user households
- Minimal, distraction-free aesthetic

### Logging

Always use `consola` (never `console.log`):

- Global log level configured from runtime config
- Available levels: trace, debug, info, warn, error, start
- Log level is set in both client and server plugins

### Database Access

- Import the singleton: `import prisma from "~/lib/prisma"`
- Prisma client is shared between client (SSR) and server
- Use `npx prisma migrate dev` for schema changes

### API Development

- Follow RESTful patterns in `server/api/`
- Return proper HTTP status codes
- Handle errors consistently
- Validate inputs before database operations

### Adding Integrations

1. Create integration folder in `server/integrations/[name]/`
2. Implement required interfaces from `app/types/integrations.ts`
3. Register in `app/integrations/integrationConfig.ts`
4. Server will auto-initialize sync intervals for enabled integrations

### Docker Deployment

Multi-stage build:

1. Builder stage: Installs deps, generates Prisma client, builds Nuxt
2. Production stage: Copies built output, runs migrations on startup
3. Exposes port 3000

## Important Files

- `nuxt.config.ts`: Nuxt configuration, plugins, modules, runtime config
- `prisma/schema.prisma`: Database schema
- `eslint.config.mjs`: Linting rules
- `app/lib/prisma.ts`: Prisma client singleton
- `app/integrations/integrationConfig.ts`: Integration registry
- `server/plugins/02.syncManager.ts`: Integration sync orchestration
