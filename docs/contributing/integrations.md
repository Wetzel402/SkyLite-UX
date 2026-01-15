---
title: Integrations
parent: Contributing
layout: default
nav_order: 8
permalink: /contributing/integrations/
---

# Integrations

Skylite UX is designed to integrate with various external and self-hosted services. This section covers how to set up and configure integrations for development.

We use the [Docker Outside of Docker](https://github.com/devcontainers/features/pkgs/container/features%2Fdocker-outside-of-docker) dev container feature for easier development.

## Integration Development

### For Self-Hosted Integrations:

1. **Create a new folder** in `Skylite-UX/.devcontainer/integrations/`
2. **Create a Docker Compose file** for the new service you are integrating (see [Docker Compose for Integrations](#docker-compose-for-integrations))
3. **Spin up the Docker container**
4. **Generate an API key** for the service (if applicable)

### For External Integrations:

1. **Obtain API credentials or OAuth credentials** for the external service (if applicable)

### Code Implementation (All Integration Types):

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
9. **Add the service in Skylite UX** via Settings > Integrations > Add Integration (the integration will now appear in the list)
10. **Test and commit** as defined in the [Development Workflow]({{ '/contributing/code/' | relative_url }}#development-workflow)

## Integration Configuration

### Docker Compose for Integrations

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

### Defining Your Integration in integrationConfig.ts

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

## Troubleshooting Integrations

### Common Issues

#### Authentication Errors

```bash
# Ensure service is on the same Docker network as dev container
# Ensure correct base URL
# Check token expiration
```

#### Data Sync Issues

```bash
# Check network connectivity
# Verify API endpoints
# Review error logs
# Test with minimal data set
```