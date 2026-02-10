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
- **port**: Port for the Web UI (default `3000`).
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

## Access the app

After the app is running, open the Web UI from the app card or go to `http://<your-home-assistant-host>:3000` (or the port you configured).

For developing or contributing to the HA app, see [Contributing: Home Assistant app]({{ '/contributing/haos/' | relative_url }}).
