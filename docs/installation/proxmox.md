---
title: Proxmox
parent: Installation
layout: default
nav_order: 5
permalink: /installation/proxmox/
---

# Proxmox

## Requirements

- A [Proxmox VE] installation(https://www.proxmox.com/en/products/proxmox-virtual-environment/get-started)

## Community install script

Run the [ProxmoxVED](https://github.com/community-scripts/ProxmoxVED) community [script](https://community-scripts.github.io/ProxmoxVED/scripts?id=skylite-ux) to install.

## Configuration

For environment variables and options, see [Docker]({{ '/installation/docker/#configuration' | relative_url }}).

## Access the app

After the script completes, open the Skylite UX Web UI at `http://<host>:3000` (or the port you configured).