# SkyLite UX Home Assistant App (formerly add-on)

Self-hosted family manager (Calendar, Todos, Shopping Lists) for Home Assistant.

## Installation

1. In Home Assistant go to **Settings** → **Apps** → **App store**.
2. Click the three dots (top right) → **Repositories**.
3. Add this repository URL: `https://github.com/wetzel402/Skylite-UX`
4. Click **Add**, then **Check for updates** (or refresh).
5. Find **SkyLite UX** in the app list and click **Install** → **Start**.

## Configuration

- **database**: Choose `bundled` (PostgreSQL runs inside the app, data on mapped volume) or `external` (use an existing PostgreSQL server; set DB_HOSTNAME, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE_NAME).
- **port**: Host port for the Web UI (default 3000).
- **data_location**: Path where app data (and bundled Postgres data) is stored (default `/data`). The mapped volume is mounted here; data persists across restarts and upgrades.
- **TZ**: Timezone (e.g. `America/Chicago`, `Europe/London`). Passed to the app as `NUXT_PUBLIC_TZ`.
- **log_level**: Logging level: `debug`, `info`, `warn`, `error`, or `verbose`. Passed to the app as `NUXT_PUBLIC_LOG_LEVEL`.

With **bundled** database, a PostgreSQL instance runs inside the app and data is stored in the mapped volume. Upgrading the app does not lose data because the same volume is reused.

## Access

After starting the app, open the Web UI from the app card or go to `http://<your-ha-host>:3000` (or the port you configured).
