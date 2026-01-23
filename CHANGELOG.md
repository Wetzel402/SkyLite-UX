# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
