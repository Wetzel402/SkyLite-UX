---
title: Integrations
layout: default
nav_order: 3
permalink: /integrations/
---

# Integrations

Skylite UX supports integrations with various external and self-hosted services to enhance your experience. Integrations allow you to sync data between Skylite UX and other services, keeping all your information in one place.

## Integration Types

### Calendar Integrations

Connect your calendars to view and manage events from external sources. Calendar integrations support reading events and, depending on the service, may also support creating, editing, and deleting events.

### Shopping Integrations

Shopping integrations allow you to add and check items on your shopping lists from connected services and keep them synchronized.

## Setting Up Integrations

1. Navigate to **Settings > Integrations** in Skylite UX
2. Click **Add Integration**
3. Select the integration type and service you want to configure
4. Fill in the required configuration fields (API keys, URLs, OAuth credentials, etc.)
5. Save the integration
6. The integration will begin syncing automatically based on its configured sync interval

**Note:** For security, credential fields are intentionally left blank when editing an existing integration. To update credentials, enter new values. To keep existing credentials, leave the fields blank and save.

## Data Privacy

While Skylite UX is self-hosted and gives you complete control over your data, third-party integrations may have their own data privacy policies. Each integration's data privacy statements should be reviewed individually. Skylite UX only stores the configuration necessary to connect to these services and does not share your data with third parties beyond what is required for the integration to function.

## Sync Behavior

Integrations sync automatically at regular intervals. The sync frequency varies by integration and is defined by the integration's developer.
