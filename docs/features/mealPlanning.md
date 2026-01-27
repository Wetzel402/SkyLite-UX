---
title: Meal Planning
layout: default
parent: Features
nav_order: 4
---

# Meal Planning

Plan your family's meals for the week with an intuitive grid interface. Create, edit, and organize meals by day and meal type (breakfast, lunch, dinner).

## Features

### Week-Based Planning

- Navigate between weeks using arrow buttons
- View a 7-day grid with three meal types per day
- Add meals to any day/meal slot with a single click
- See meal preparation reminders for advance prep needs

### Meal Details

Each meal can include:

- **Name** - What you're making
- **Description** - Recipe notes, ingredients, or serving details
- **Meal Type** - Breakfast, Lunch, or Dinner
- **Day of Week** - Monday through Sunday
- **Days in Advance** - Set prep reminders (e.g., "defrost 1 day before")
- **Completed Status** - Mark meals as prepared/cooked

### Offline Support (PWA)

**Work anywhere, sync when connected!**

The meal planner includes Progressive Web App (PWA) support, allowing you to plan meals even when you can't reach your home server.

#### Installing the PWA

1. **On Mobile (iOS/Android):**
   - Open Skylite UX in your mobile browser (Chrome, Safari, etc.)
   - Tap the browser's menu (⋮ or share icon)
   - Select "Add to Home Screen" or "Install App"
   - Confirm installation
   - Launch from your home screen like a native app

2. **On Desktop (Chrome/Edge):**
   - Open Skylite UX in your browser
   - Look for the install icon in the address bar
   - Click "Install" in the prompt
   - Or use browser menu → "Install Skylite UX"

#### How Offline Mode Works

When you're away from home and can't reach your server:

1. **Add Meals Offline**
   - Open the meal planner
   - Add meals as usual by clicking on any day/meal slot
   - Meals are saved locally to your device
   - A yellow dot indicator shows pending meals waiting to sync

2. **Automatic Sync**
   - When you return home (or connection restored), meals sync automatically
   - The app checks for pending changes every 30 seconds
   - No manual action needed - it just works!

3. **Sync Status Bar**
   - See your connection status at the top of the meal planner
   - **Offline** - Changes saved locally, will sync when connected
   - **Syncing...** - Currently uploading your changes
   - **X meals pending sync** - Shows how many meals are waiting

4. **Manual Sync**
   - Tap "Sync Now" button to force immediate sync
   - Useful after reconnecting to ensure everything is up-to-date

#### Offline Queue Management

View and manage pending changes at `/offline-queue`:

- See all meals waiting to sync
- View any sync errors
- Retry failed syncs
- Delete queued items if needed
- Clear all pending changes

#### Limitations

- **Read-Only When Offline**: You can add new meals, but editing/deleting requires a connection
- **Other Devices**: Changes won't appear on other devices until synced
- **Storage**: Limited by browser storage (typically 50MB+)

### Multi-Device Sync

When online, all changes sync in real-time:

- Edit a meal on your phone → appears instantly on the kitchen tablet
- Family members can collaborate simultaneously
- Server-Sent Events (SSE) provide live updates

## Common Use Cases

### Weekly Meal Prep at Work

**Problem**: You're at work (outside your home network) and want to plan next week's meals.

**Solution**:

1. Install the PWA on your phone
2. Open the meal planner during lunch break
3. Add meals for the week (works offline)
4. When you get home, meals automatically sync to the home server
5. Family sees the meal plan on the kitchen tablet

### Grocery Shopping

**Problem**: You're at the store and need to check what meals you planned.

**Solution**:

1. Open the PWA on your phone
2. View the meal plan (cached from last sync)
3. Check ingredients needed for each meal
4. Add items to shopping list if integrated

### Family Collaboration

**Problem**: Multiple family members want to contribute to meal planning.

**Solution**:

1. Each person installs the PWA on their device
2. Anyone can add meals when inspiration strikes
3. Changes sync automatically when devices are home
4. Real-time updates show everyone's contributions

## Tips

### Offline Planning

- **Install the PWA** before going offline for best experience
- **Open the app once** while online to cache the latest data
- **Check the sync status bar** to ensure changes uploaded
- **Use the offline queue** to verify what's pending

### Meal Organization

- **Use Days in Advance** for meals requiring prep (defrosting, marinating)
- **Add detailed descriptions** with recipe links or serving sizes
- **Mark as completed** as you cook to track progress
- **Plan multiple weeks** by navigating forward

### Performance

- **Cache cleared on browser clear** - data is stored locally
- **Works offline indefinitely** - no timeout on local storage
- **Sync is idempotent** - safe to sync multiple times
- **Background sync** happens automatically when app is open

## Troubleshooting

### PWA Won't Install

- **Check browser support**: Chrome/Edge (desktop/mobile), Safari (iOS)
- **Verify HTTPS**: PWAs require secure connection (https:// or localhost)
- **Clear browser cache**: Old service worker might be cached

### Meals Not Syncing

1. Check connection status in sync status bar
2. Verify you can reach your home server (try opening home page)
3. Visit `/offline-queue` to see pending items
4. Try "Sync Now" button to force sync
5. Check for error messages in queue

### Yellow Dots Still Showing

- **Wait 30 seconds**: Auto-sync runs every 30 seconds
- **Check offline queue**: Verify items were actually synced
- **Force refresh**: Close and reopen the app
- **Clear cache**: Last resort - will need to re-sync

### Changes Lost

- **Browser storage cleared**: Check browser settings
- **Different device**: Each device has its own offline storage
- **Server reset**: Data only persists after successful sync

## Technical Details

### Storage Technology

- **IndexedDB**: Browser-native database for offline storage
- **Service Worker**: Enables offline functionality and caching
- **PWA Manifest**: Makes app installable on devices

### Sync Strategy

- **Optimistic Updates**: UI updates immediately, syncs in background
- **Conflict Resolution**: Server always wins (last-write-wins)
- **Retry Logic**: Failed syncs automatically retry on reconnect

### Security

- **Local Storage Only**: Offline data never leaves your device until sync
- **Authentication Required**: Must be logged in to sync
- **No Cloud Storage**: Data stays on your devices and home server

---

For setup and configuration, see the [Installation Guide](../installation/).
