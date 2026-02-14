---
title: Home Assistant
parent: Installation
layout: default
nav_order: 4
permalink: /installation/haos/
---

# Home Assistant

Run Skylite UX as a Home Assistant app with optional bundled PostgreSQL or an external database.

## Requirements

- [Home Assistant OS](https://www.home-assistant.io/installation/) or Home Assistant Supervised.

## Add the repository
<br>
[![Open your Home Assistant instance and show the add app repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FWetzel402%2FSkylite-UX)

1. In Home Assistant go to **Settings** → **Apps** → **Install app**.
2. Click the three dots (top right) → **Repositories**.
3. Add this repository URL: `https://github.com/wetzel402/Skylite-UX`
4. Click **Add**, then **Check for updates** (or refresh the page).

## Install the app

1. Find **SkyLite UX** in the app list (under the repository you added).
2. Click **Install** → wait for the image to download (or build).
3. Open the **Configuration** tab and set options as needed (see below).
4. Click **Start**.

## Configuration

Set the following options in the app **Configuration** tab:

- **database**: Choose **bundled** (PostgreSQL runs inside the app; data is stored on a mapped volume and survives restarts and upgrades) or **external** to use an existing PostgreSQL server (e.g. another app or host).
- **data_location**: Path where app and bundled database data is stored (default `/data`). The mapped volume is mounted here.
- **TZ**: Timezone (e.g. `America/Chicago`, `Europe/London`).
- **log_level**: Logging level: `debug`, `info`, `warn`, `error`, or `verbose`.

### Using an external PostgreSQL

Set **database** to `external`, then set:

- **DB_HOSTNAME**: Hostname or IP of your PostgreSQL server (e.g. `homeassistant.local` or the hostname of another app).
- **DB_PORT**: Port (default `5432`).
- **DB_USERNAME**: PostgreSQL user.
- **DB_PASSWORD**: Password for that user.
- **DB_DATABASE_NAME**: Database name (e.g. `skylite`).

#### Using the Postgres 17 app from [alexbelgium](https://github.com/alexbelgium)
<br>
[![Open your Home Assistant instance and show the add app repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Falexbelgium%2Fhassio-addons)

You can use a dedicated PostgreSQL app such as [Postgres 17](https://github.com/alexbelgium/hassio-addons/tree/master/postgres_17) from the alexbelgium hassio-addons repository. Add the repository `https://github.com/alexbelgium/hassio-addons` in **Settings → Apps → Repositories**, install **Postgres 17**, then configure a user and database (or use the add-on's defaults). Use the add-on's documented hostname (or the one shown in its Info or Network tab) as **DB_HOSTNAME** in SkyLite UX.

#### Example configuration

When using the Postgres 17 add-on with its default user and `skylite` database name, SkyLite UX configuration can look like this (hostname may vary by installation; use a strong password in production):

```yaml
database: external
DB_HOSTNAME: db21ed7f-postgres-latest
DB_PORT: 5432
DB_USERNAME: postgres
DB_PASSWORD: homeassistant
DB_DATABASE_NAME: skylite
```

## Access the app

After the app is running, open the Web UI from the app card or go to `http://<your-home-assistant-host>:3000` (or the port you configured).

For developing or contributing to the HA app, see [Contributing: Home Assistant app]({{ '/contributing/haos/' | relative_url }}).
