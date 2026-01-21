---
title: Calendar
parent: Integrations
layout: default
nav_order: 4
permalink: /integrations/calendar/
---

# Calendar

Calendar integrations allow you to connect external calendar services to Skylite UX. You can view events from multiple calendars in a unified view, and depending on the integration, create, edit, and delete events.

**Home Screen Integration**: Events from connected calendars also appear in the "Upcoming Events" widget on the Home Screen, showing the next 5 upcoming events with smart date formatting.

## General Setup

1. In Skylite UX, go to **Settings > Integrations > Add Integration**
2. Select **Calendar** as the type and the service you are setting up
3. Configure:
   - **Credentials**: iCal URL, API key, OAuth client ID, etc.
   - **User**: Select which user(s) to link events to, or leave blank (optional)
   - **Event Color**: Choose a color for events from this calendar (optional)
   - **Use User Profile Colors**: Enable to use individual user profile colors instead of a single event color (optional)
4. Save the integration

---

## iCal

The iCal integration allows you to connect to any calendar that provides an iCal (`.ics`) feed URL. This is a read-only integration, meaning you can view events from the external calendar but cannot create, edit, or delete events through Skylite UX.

### Capabilities

- **Get events**: View events from the connected calendar feed

### Setup Instructions

1. Obtain the iCal feed URL from your calendar service
   - Common formats: `https://example.com/calendar.ics` or `webcal://example.com/calendar.ics`
   - Many calendar services provide iCal feed URLs in their settings
2. Follow the [general setup instructions](#general-setup) above.

---

## Google Calendar

The Google Calendar integration provides full two-way synchronization with your Google Calendar account. You can view, create, edit, and delete events, and select which calendars to sync.

### Capabilities

- **Get events**: View events from selected Google Calendars
- **Add events**: Create new events in Google Calendar
- **Edit events**: Modify existing events in Google Calendar
- **Delete events**: Remove events from Google Calendar
- **OAuth authentication**: Secure authentication using Google OAuth
- **Select calendars**: Choose which calendars to sync

### Setup Instructions

#### Administrator Setup (One-Time)

Before users can connect their Google Calendar, an administrator must configure OAuth credentials:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Navigate to **APIs & Services > Library**
   - Search for "Google Calendar API"
   - Click **Enable**
4. Create OAuth 2.0 credentials:
   - Go to **APIs & Services > Credentials**
   - Click **Create Credentials > OAuth client ID**
   - If prompted, configure the OAuth consent screen first
   - Select **Web application** as the application type
   - Add authorized redirect URIs:
     - For local development: `http://localhost:3000/api/integrations/google_calendar/callback`
     - For production: `https://your-domain.com/api/integrations/google_calendar/callback`
   - Click **Create**
5. Copy the **Client ID** and **Client Secret**
6. Add the credentials to your environment:
   - Create or update your `.env` file:
     ```env
     GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
     GOOGLE_CLIENT_SECRET=your-client-secret
     ```
   - For Docker deployments, pass as environment variables:
     ```bash
     docker run -e GOOGLE_CLIENT_ID=xxx -e GOOGLE_CLIENT_SECRET=xxx ...
     ```

#### User Setup

Once the administrator has configured the OAuth credentials:

1. In Skylite UX, go to **Settings > Integrations > Add Integration**
2. Select **Calendar** as the type and **Google** as the service
3. Give the integration a name (optional)
4. Click **Save** - you will be redirected to Google to sign in
5. Sign in with your Google account and grant calendar access
6. After authorization, you will be redirected back to Skylite UX
7. Click **Select Calendars** to choose which calendars to sync
8. Configure calendar settings:
   - Choose user(s) to link events to
   - Set calendar event color
   - Enable/disable user profile colors

---

### Troubleshooting

- **"Google Calendar integration is not configured"**: The administrator needs to set the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables
- **OAuth errors**: Ensure the redirect URI is correctly configured in Google Cloud Console to match your deployment URL
- **Calendar not appearing**: Verify the Google Calendar API is enabled in your Google Cloud project
- **Permission denied**: Check that you've granted the necessary permissions during OAuth authorization
- **"Authentication expired"**: Click on the integration in Settings and save again to re-authorize
