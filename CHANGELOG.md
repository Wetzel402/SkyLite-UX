# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Progressive Web App (PWA) Support**
  - Installable on mobile devices and desktop
  - Service worker for offline caching
  - App manifest with 192x192 and 512x512 icons
  - Offline-first architecture with automatic sync
- **Offline Meal Planning**
  - Add meals while disconnected from home server
  - IndexedDB-based offline storage queue
  - Automatic sync when connection restored
  - Manual "Sync Now" button for immediate sync
  - Real-time sync status indicator (offline/syncing/pending)
  - Offline queue management page at `/offline-queue`
  - Optimistic UI updates with pending meal indicators
  - 30-second auto-sync interval when online
- **Google Photos URL Refresh**
  - New `/api/selected-albums/refresh` endpoint
  - Automatic hourly URL refresh to prevent expiration
  - Immediate refresh on home page load
  - Prevents 403 errors from expired photo URLs
- **Photo Playback Mode Selection**
  - Random or sequential photo playback
  - Persists selection in home settings
  - Proper validation with Zod enum schema
- Google Tasks integration (read-only)
  - View Google Tasks alongside local todos
  - Display calendar reminders as todos
  - Source badges to distinguish local vs Google tasks
  - Automatic token refresh
  - Fetch on page load and sync interval
- New API endpoints for Google Tasks
  - `GET /api/integrations/google_tasks/authorize` - OAuth initiation
  - `GET /api/integrations/google_tasks/callback` - OAuth callback
  - `GET /api/integrations/google_tasks/all-tasks` - Fetch all Google Tasks
  - `GET /api/integrations/google_calendar/reminders` - Fetch calendar reminders
- GoogleTasksServerService class for server-side Google Tasks API integration
- Comprehensive documentation for Google Tasks integration
- Virtual columns in todo list page for Google Tasks and Calendar reminders
- Merged display of todos from multiple sources in home page widget

### Changed
- Updated home page `fetchTodaysTasks` to include Google Tasks and Calendar reminders
- Updated todo list page to display Google Tasks and Calendar reminders alongside local todos
- Enhanced integrationConfig to support "tasks" type integrations

### Technical Details
- No database changes required (fetch-on-demand architecture)
- OAuth 2.0 with automatic token refresh
- Parallel fetching for optimal performance
- Error tolerance ensures local todos always display
