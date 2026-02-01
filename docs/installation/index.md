---
title: Installation
layout: default
nav_order: 2
permalink: /installation/
has_children: true
---

# Installation

Skylite UX is designed to be self-hosted, giving you complete control over your data. It should be noted that the same cannot be said for third-party integrations and each integration's data privacy statements should be reviewed individually.

## Installation Options

Choose the installation method that best fits your needs:

### [Docker](docker/)
**Recommended for self-hosted servers**

- Deploy on any server or home network
- SQLite or PostgreSQL database options
- Easy configuration with environment variables
- Automatic database migrations
- Ideal for: Raspberry Pi, home servers, VPS, NAS devices

[View Docker installation guide →](docker/)

### [Mobile (Android)](mobile/)
**For mobile devices with offline support**

- Native Android APK with Capacitor
- Full offline functionality with auto-sync
- Mobile-optimized UI (collapsible columns, touch-friendly)
- Progressive Web App (PWA) alternative for iOS/desktop
- Connects to your self-hosted server
- Ideal for: Phones, tablets, on-the-go access

[View mobile installation guide →](mobile/)

---

## Quick Start

**For self-hosted server:**
```bash
docker run -d -p 3000:3000 -v ~/skylite-data:/data y3knik/skylite-ux:beta
```

**For mobile device:**
1. Download APK from [GitHub Releases](https://github.com/y3knik/SkyLite-UX/releases)
2. Install on Android device
3. Configure your server URL

---

## System Requirements

### Docker (Server)
- **OS:** Linux, macOS, Windows (with Docker)
- **Memory:** 512MB minimum, 1GB recommended
- **Storage:** 1GB minimum for app + database
- **Network:** Internet connection for integrations (optional)

### Mobile (Android)
- **Android:** 7.0 (Nougat) or higher
- **Storage:** ~8MB for app, additional for offline queue
- **Network:** Wi-Fi or mobile data for server sync

### Mobile (PWA)
- **Browser:** Chrome 67+, Safari 11.1+, Edge 79+
- **Server:** HTTPS required (except localhost)

---

## Architecture Overview

Skylite UX uses a **client-server architecture**:

1. **Server** - Self-hosted Nuxt/Node.js application (Docker)
2. **Clients** - Web browsers, mobile apps, PWAs
3. **Database** - SQLite (default) or PostgreSQL
4. **Integrations** - Optional Google Calendar, Photos, Tasks, Mealie, Tandoor

```
┌─────────────────┐
│  Mobile App     │ ───┐
│  (Android APK)  │    │
└─────────────────┘    │
                       │
┌─────────────────┐    │    ┌──────────────────┐    ┌──────────────┐
│  Web Browser    │ ───┼───→│  Skylite Server  │───→│  Database    │
│  (Desktop/PWA)  │    │    │  (Docker)        │    │  (SQLite/PG) │
└─────────────────┘    │    └──────────────────┘    └──────────────┘
                       │
┌─────────────────┐    │
│  Mobile PWA     │ ───┘
│  (iOS/Android)  │
└─────────────────┘
```

**Key Points:**
- Mobile apps connect to your self-hosted server
- Server URL is user-configurable
- Offline support with local IndexedDB queue
- All data syncs to your server

---

For detailed installation instructions, choose your preferred method above.
