---
title: Home Assistant App (formerly add-on)
parent: Contributing
layout: default
nav_order: 8
permalink: /contributing/haos/
---

# Home Assistant App (formerly add-on)

This guide is for contributors working on the Skylite UX Home Assistant app. For changes to Skylite-UX itself see the [Code]({{ '/contributing/code/' | relative_url }}) guide.

## Where the HA app lives

The HA app lives in the `ha-app/` folder and the repo root:

- **ha-app/config.yaml** – Supervisor config, options defaults, and schema. For generic app folder structure and config keys, see the [Home Assistant app configuration](https://developers.home-assistant.io/docs/add-ons/configuration/) docs.
- **ha-app/Dockerfile** – Multi-stage build; uses the repo root as build context so it can copy the built app and `ha-app/run.sh`.
- **ha-app/run.sh** – Entrypoint: reads options from `/data/options.json`, starts bundled Postgres or uses external DB, runs migrations, then starts the Node server.
- **ha-app/README.md** – Copy of the root README; shown in the Home Assistant app store. Kept in sync via `npm run copy-readme`. Do not edit directly.
- **repository.yaml** (repo root) – Defines this repo as a Home Assistant app repository. For repository format, see [Create an app repository](https://developers.home-assistant.io/docs/add-ons/repository/).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- If using dev containers: [Visual Studio Code](https://code.visualstudio.com/) and the [Remote Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension

See the [Home Assistant testing guide](https://developers.home-assistant.io/docs/apps/testing) for details.

## Dev container (Local Apps)

To run the Skylite app under Local Apps with Supervisor and Home Assistant inside VS Code:

1. **Open this repo as the workspace** — Clone the Skylite-UX repo and open its **root** folder in VS Code. The workspace root must be the repo root so that `ha-app/` is a direct child (Supervisor only discovers add-ons that are direct children of the workspace root).
2. **Add the HA devcontainer files** — Copy `.devcontainer/devcontainer.json` and `.vscode/tasks.json` from the [Home Assistant local app testing](https://developers.home-assistant.io/docs/apps/testing) setup (or from an official HA app repository) into this repo. 
**Note:** You will overwrite this repo’s existing `.devcontainer`. It is for Skylite-UX app development; for HA app testing you use the HA devcontainer so Supervisor and Home Assistant run inside the container.
3. **Reopen in container** — Use Command Palette → "Rebuild and Reopen in Container". The workspace root inside the container remains the Skylite repo root, so `ha-app/` is visible to Supervisor.
4. **Start Home Assistant** — Run the task **Start Home Assistant** (Terminal → Run Task). After Supervisor and HA finish starting, open `http://localhost:7123`, complete onboarding if needed, then go to **Settings → Apps**; the Skylite app should appear under the Local repository.

If the app does not appear, confirm the workspace root is the Skylite repo root (so `ha-app/config.yaml` exists at `ha-app/config.yaml` from the root) and that you ran the Start Home Assistant task.

## Remote development (bare hardware)

To test on a real Home Assistant device, copy the **full repo** into a subdirectory of `/addons` (e.g. via the Samba or SSH add-on) so the Dockerfile build context and `ha-app/` paths work. Comment out the `image` key in **ha-app/config.yaml** (e.g. `#image: wetzel402/skylite-ux-ha`) so the device builds the app locally instead of pulling from Docker Hub. See [Remote development](https://developers.home-assistant.io/docs/apps/testing#remote-development) for the generic steps.

## Building the image locally

From the repo root:

```bash
docker build -f ha-app/Dockerfile -t skylite-ux-ha:local .
```

Build context is the repo root so the Dockerfile can copy app build artifacts and `ha-app/run.sh`. To set the `io.hass.version` label (default is `dev`), pass a build arg:

```bash
docker build -f ha-app/Dockerfile --build-arg BUILD_VERSION=2026.2.2 -t skylite-ux-ha:local .
```

## Testing locally

Simulate the Supervisor environment with Docker. For how Supervisor provides options and mounts, see the [Home Assistant app configuration](https://developers.home-assistant.io/docs/add-ons/configuration/) (app script) docs.

1. Create a minimal `options.json` (e.g. in a temp directory) with our app’s options:

```json
{
  "database": "bundled",
  "data_location": "/data",
  "TZ": "America/Chicago",
  "log_level": "info",
  "port": 3000,
  "DB_HOSTNAME": "",
  "DB_PORT": 5432,
  "DB_USERNAME": "",
  "DB_PASSWORD": "",
  "DB_DATABASE_NAME": "skylite"
}
```

2. Run the image with that file and a data volume:

```bash
docker run --rm -it \
  -v "$(pwd)/options.json:/data/options.json" \
  -v skylite-ha-data:/data \
  -p 3000:3000 \
  skylite-ux-ha:local
```

Open `http://localhost:3000` for the Web UI. Bundled Postgres will initialize on first run (create DB and user); reuse the same volume for persistence across runs.

## Logs

When running via Supervisor, app logs appear in the app’s log tab in the Home Assistant panel. When running locally with Docker, use `docker logs <container>`.
