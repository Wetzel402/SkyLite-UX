---
title: Shopping
parent: Integrations
layout: default
nav_order: 5
permalink: /integrations/shopping/
---

# Shopping

Shopping integrations allow you to sync your shopping lists with Skylite UX. Items added to shopping lists in connected services will appear in Skylite UX and vice versa, and you can manage them alongside your other shopping lists.

## General Setup

1. In Skylite UX, go to **Settings > Integrations > Add Integration**
2. Select **Shopping** as the type and the service you are setting up
3. Configure:
   - **API Key**: Your authentication token from the service (required)
   - **Base URL**: The full URL of your service instance, including protocol and port if needed (required)
4. Save the integration

---

## Mealie

[Mealie](https://github.com/mealie-recipes/mealie/) is a self-hosted meal planning service that helps you organize recipes and meal plans. The Mealie integration allows you to sync shopping lists from your Mealie instance to Skylite UX.

### Capabilities

- **Add items**: Add new items to shopping lists from Mealie
- **Edit items**: Modify existing items in synchronized lists
- **Clear items**: Clear completed items from lists

### Setup Instructions

1. Obtain an API key from your Mealie instance:
   - Log in to your Mealie instance
   - Navigate to **Settings > API Tokens**
   - Create a new API token
   - Copy the API key (you won't be able to see it again)
2. Follow the [general setup instructions](#general-setup) above.

---

## Tandoor

[Tandoor](https://github.com/TandoorRecipes/recipes) is a self-hosted recipe management service. The Tandoor integration allows you to sync shopping lists from your Tandoor instance to Skylite UX.

### Capabilities

- **Add items**: Add new items to shopping lists from Tandoor
- **Edit items**: Modify existing items in synchronized lists

### Setup Instructions

1. Obtain an API key from your Tandoor instance:
   - Log in to your Tandoor instance
   - Navigate to **Settings > API**
   - Create a new API token
   - **Important**: Ensure the API key has **"read write"** scope/permissions
   - Copy the API key (you won't be able to see it again)
2. Follow the [general setup instructions](#general-setup) above.

### Troubleshooting

- **Connection errors**: Verify your Base URL is correct and accessible from your Skylite UX instance
- **Authentication errors**: Ensure your API key has the necessary scope and is valid
- **Items not syncing**: Check that the container is running and the API is accessible
