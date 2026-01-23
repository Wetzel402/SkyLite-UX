# Google Tasks Integration

## Overview

The Google Tasks integration allows you to view your Google Tasks alongside local todos. This is a **read-only integration** - tasks are fetched from Google and displayed in the UI, but not stored in the database.

## Features

- View all incomplete Google Tasks from all task lists
- View short calendar events (reminders) from Google Calendar
- Display on todo list page with source badges
- Include in home page "Today's Tasks" widget
- Automatic token refresh

## Setup

1. Configure Google OAuth credentials in `.env`:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

2. Navigate to Settings in the app
3. Click on the "Tasks" tab in the Integrations section
4. Click "Add Integration"
5. Select "Google" as the service
6. Authorize with Google (consent screen)
7. Tasks will appear automatically on todo list page and home page

## OAuth Scope

- `https://www.googleapis.com/auth/tasks` - Read-only access to Google Tasks

## API Endpoints

- `GET /api/integrations/google_tasks/authorize` - Initiate OAuth flow
- `GET /api/integrations/google_tasks/callback` - OAuth callback
- `GET /api/integrations/google_tasks/all-tasks` - Fetch all incomplete tasks
- `GET /api/integrations/google_calendar/reminders` - Fetch short calendar events

## How It Works

1. User authorizes Google Tasks integration
2. Refresh token stored in database (Integration.apiKey)
3. Access token stored in settings (Integration.settings.accessToken)
4. When user opens todo list or home page:
   - App fetches local todos from database
   - App fetches Google Tasks from Google Tasks API
   - App fetches calendar reminders from Google Calendar API
   - All sources merged in UI with source badges
5. Token automatically refreshed when expired (30s buffer)

## Data Storage

**No Google data is stored in the database.** All Google Tasks and Calendar reminders are fetched on-demand when pages load.

## UI Display

### Todo List Page

Google Tasks and Calendar reminders appear as separate virtual columns:
- **Google Tasks** column: Shows all incomplete Google Tasks
- **Calendar Reminders** column: Shows short calendar events (1 hour or less)
- Each item includes a source indicator (google_tasks or calendar_reminder)

### Home Page

The "Today's Tasks" widget shows:
- Local todos due today or without due date
- Google Tasks due today or without due date
- Calendar reminders due today
- Limited to 5 tasks total, merged from all sources

## Troubleshooting

### No tasks showing
- Check that integration is enabled in Settings
- Verify that Google Tasks is not empty in Google Tasks app
- Check browser console for error messages

### 403 errors
- Re-authorize the integration (token may have expired)
- Check that OAuth credentials are correctly configured

### Missing tasks
- Ensure task lists are not empty in Google Tasks
- Only incomplete tasks are fetched
- Tasks are fetched from all task lists

### Token refresh issues
- Tokens are automatically refreshed 30 seconds before expiry
- If refresh fails, re-authorize the integration

## Technical Details

### Token Management

The integration uses OAuth 2.0 with refresh tokens:
- Refresh token stored in `Integration.apiKey`
- Access token stored in `Integration.settings.accessToken`
- Expiry date stored in `Integration.settings.expiryDate`
- Tokens automatically refreshed by GoogleTasksServerService

### Performance

- Parallel fetching: Local todos, Google Tasks, and Calendar reminders are fetched in parallel
- No caching: Fresh data on every page load
- Error tolerance: If Google APIs fail, only local todos are shown

### Security

- OAuth tokens are stored securely in the database
- No Google data is cached locally
- API requests are made server-side
- Automatic token refresh ensures continuous access
