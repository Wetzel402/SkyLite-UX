---
title: Mobile (Android)
parent: Installation
layout: default
nav_order: 4
permalink: /installation/mobile/
---

# Mobile (Android)

Skylite UX is available as a native Android application with full offline support and mobile-optimized UI.

## Installation Methods

### Native Android APK (Recommended)

The native APK provides the best mobile experience with full offline functionality.

**Features:**
- **Full offline support** - Add meals and todos while disconnected, auto-syncs when online
- **Native performance** - Built with Capacitor for fast, responsive UI
- **Mobile-optimized** - Collapsible columns, touch-friendly controls, no horizontal scrollbars
- **Background sync** - Automatic synchronization when network is restored

### Progressive Web App (PWA)

Install directly from your browser without downloading an APK.

**Features:**
- **Cross-platform** - Works on Android, iOS, and desktop
- **Automatic updates** - No manual APK downloads
- **Service worker caching** - Basic offline support
- **No app store required** - Install from any browser

---

## Native APK Installation

### 1. Download the APK

Visit the [GitHub Releases](https://github.com/y3knik/SkyLite-UX/releases) page and download the latest `app-release.apk` file.

**Direct download link:**
```
https://github.com/y3knik/SkyLite-UX/releases/latest
```

Look for the file named `app-release.apk` in the Assets section.

### 2. Enable "Install from Unknown Sources"

Before installing the APK, you need to allow installation from unknown sources:

**Android 8.0+ (Oreo and newer):**
1. Open **Settings**
2. Go to **Apps & notifications** → **Advanced** → **Special app access**
3. Tap **Install unknown apps**
4. Select your browser or file manager
5. Toggle **Allow from this source**

**Android 7.1 and older:**
1. Open **Settings**
2. Go to **Security**
3. Enable **Unknown sources**
4. Confirm the warning dialog

### 3. Install the APK

1. Open the downloaded `app-release.apk` file
2. Tap **Install**
3. Wait for installation to complete
4. Tap **Open** to launch Skylite UX

### 4. Configure Server URL

On first launch, you'll be redirected to the Mobile Settings page:

1. Enter your Skylite server URL (e.g., `https://skylite.example.com` or `http://192.168.1.100:3000`)
2. Do **not** include a trailing slash
3. Use `http://` for local development or `https://` for production
4. Tap **Save** or navigate away to persist the setting

**Example URLs:**
- Production: `https://skylite.example.com`
- Local network: `http://192.168.1.100:3000`
- Tailscale/VPN: `http://100.64.0.5:3000`

Once configured, the app will sync with your self-hosted Skylite server.

---

## Progressive Web App (PWA) Installation

### Android Installation

1. Open your Skylite server URL in **Chrome** (e.g., `https://skylite.example.com`)
2. Tap the **menu icon** (⋮) in the top-right corner
3. Select **Add to Home screen** or **Install app**
4. Customize the name if desired
5. Tap **Add** or **Install**

The Skylite icon will appear on your home screen.

### iOS Installation

1. Open your Skylite server URL in **Safari** (e.g., `https://skylite.example.com`)
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **Add to Home Screen**
4. Customize the name if desired
5. Tap **Add**

The Skylite icon will appear on your home screen.

### Desktop Installation

**Chrome/Edge:**
1. Open your Skylite server URL
2. Click the **install icon** (⊕) in the address bar
3. Click **Install**

**Firefox:**
PWA installation not supported. Use the website normally or add a bookmark.

---

## Offline Support

The mobile app provides full offline functionality with automatic synchronization.

### Supported Offline Operations

| Feature          | Create | Update | Delete | Sync When Online |
| ---------------- | ------ | ------ | ------ | ---------------- |
| **Todos**        | ✅      | ✅      | ✅      | ✅                |
| **Meals**        | ✅      | ✅      | ✅      | ✅                |
| **Shopping**     | ✅      | ✅      | ✅      | ✅                |
| Calendar Events  | ❌      | ❌      | ❌      | Read-only        |

### How Offline Queue Works

1. **While offline**, all create/update/delete operations are saved to IndexedDB
2. **Optimistic updates** - UI updates immediately for instant feedback
3. **When online**, queued operations automatically sync to the server
4. **Conflict resolution** - Server data takes precedence on sync

### View Offline Queue

Navigate to **Settings** → **Offline Queue** to see pending operations:
- Operation type (POST, PUT, DELETE)
- Endpoint (e.g., `/api/todos`)
- Timestamp
- Payload data

You can manually retry failed operations or clear the queue.

---

## Mobile-Optimized Features

### Collapsible Columns

On mobile screens, todo lists and shopping lists collapse by default:

- Tap the **column header** to expand/collapse
- **Chevron icon** indicates state (▼ = collapsed, ▲ = expanded)
- State persists while on the page

### Accordion State Preservation

When adding, editing, or deleting meals:

- The **accordion stays open** on the day you're working on
- No jump back to Monday after operations
- Smooth, predictable UX

### No Horizontal Scrollbars

All pages are optimized to fit within the screen width:

- Content area accounts for the 50px sidebar
- Modals and overlays position correctly
- Smooth scrolling without horizontal overflow

### Touch-Friendly Controls

- **Minimum 44×44px tap targets** for all interactive elements
- Large touch areas for buttons and links
- Swipe gestures where applicable

---

## Troubleshooting

### App Won't Install

**Error: "App not installed"**

- Ensure you have enough storage space (app requires ~8MB)
- Try uninstalling any previous version first
- Reboot your device and try again

**Error: "Install blocked"**

- Check that "Install from unknown sources" is enabled for your browser/file manager
- Some Android skins (Samsung, Xiaomi) have additional security settings - check device-specific settings

### Can't Connect to Server

**"Network Error" or "Failed to fetch"**

1. Verify your server URL is correct (no trailing slash)
2. Check that your server is running and accessible
3. If using `https://`, ensure your SSL certificate is valid
4. For local network access, ensure your phone is on the same network

**Testing server connectivity:**

Open your server URL in a mobile browser first. If it loads, the APK should work.

### Offline Queue Not Syncing

1. Navigate to **Settings** → **Offline Queue**
2. Check for error messages on failed operations
3. Manually retry operations or clear the queue
4. If problems persist, the server may be rejecting requests (check server logs)

### App Crashes on Launch

1. Clear app data: **Settings** → **Apps** → **SkyLite UX** → **Storage** → **Clear data**
2. Uninstall and reinstall the app
3. Check that you're running Android 7.0 or higher
4. Report the issue on [GitHub Issues](https://github.com/y3knik/SkyLite-UX/issues)

### PWA Not Installing

**Chrome/Android:**
- Ensure the site is served over HTTPS (PWA requires secure connection)
- Check that JavaScript is enabled
- Try clearing browser cache and reloading

**Safari/iOS:**
- PWAs on iOS have limited offline functionality compared to Android
- Use "Add to Home Screen" instead of browser-based "Install"

---

## Updating the App

### Native APK Updates

APK updates are **manual** - the app does not auto-update:

1. Check [GitHub Releases](https://github.com/y3knik/SkyLite-UX/releases) for new versions
2. Download the latest `app-release.apk`
3. Install over the existing app (your data and settings are preserved)
4. No need to uninstall first

**Future:** Google Play Store releases will enable automatic updates.

### PWA Updates

PWAs update **automatically** when you reload the page:

1. Service worker checks for updates on each launch
2. New version downloads in the background
3. Reload the app to apply updates
4. No manual download required

---

## Comparison: APK vs. PWA

| Feature                  | Native APK           | PWA                  |
| ------------------------ | -------------------- | -------------------- |
| **Installation**         | Download + install   | Add to Home Screen   |
| **Offline Support**      | Full (IndexedDB)     | Limited (cache)      |
| **Native APIs**          | Full Capacitor       | Limited              |
| **Updates**              | Manual (GitHub)      | Automatic            |
| **File Size**            | ~8MB download        | Cached as needed     |
| **Distribution**         | GitHub Releases      | Any browser          |
| **Platform Support**     | Android only         | Android, iOS, Desktop|
| **Performance**          | Native (fast)        | Web (slightly slower)|
| **Background Sync**      | Full support         | Limited              |

**Recommendation:**
- Use **Native APK** for best mobile experience and full offline support
- Use **PWA** for cross-platform compatibility or if you can't install APKs

---

## Requirements

### Native APK

- **Android version:** 7.0 (Nougat) or higher
- **Storage:** ~8MB for app, additional space for offline queue
- **Network:** Wi-Fi or mobile data for server sync

### PWA

- **Browser:** Chrome 67+, Safari 11.1+, Edge 79+
- **Server:** HTTPS required (except localhost)
- **Network:** Internet connection for initial load and sync

---

## Privacy & Security

### Data Storage

**Native APK:**
- Offline queue stored in IndexedDB (local to device)
- Server URL stored in native Preferences (encrypted by Android)
- No data sent to third parties

**PWA:**
- Service worker cache (browser-managed)
- All data stored in browser storage (IndexedDB, localStorage)
- Cleared when browser cache is cleared

### Network Security

- Use **HTTPS** for production deployments
- Server URL is user-configurable (connect to your own server)
- No telemetry or analytics sent to external services

---

## Support

### Getting Help

- **Documentation:** [https://y3knik.github.io/SkyLite-UX/](https://y3knik.github.io/SkyLite-UX/)
- **GitHub Issues:** [https://github.com/y3knik/SkyLite-UX/issues](https://github.com/y3knik/SkyLite-UX/issues)
- **Discord:** [https://discord.gg/KJn3YfWxn7](https://discord.gg/KJn3YfWxn7)

### Reporting Bugs

When reporting mobile-specific issues, include:

1. Android version (e.g., Android 14)
2. Device model (e.g., Pixel 7, Samsung Galaxy S23)
3. Installation method (APK or PWA)
4. Server URL type (local network, HTTPS, etc.)
5. Steps to reproduce
6. Screenshots or logs (if applicable)
