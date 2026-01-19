---
title: Photos
parent: Integrations
layout: default
nav_order: 5
permalink: /integrations/photos/
---

# Photos

Photo integrations allow you to connect external photo services to Skylite UX. Photos are displayed on the Home screen as a beautiful ambient slideshow with Ken Burns effect (pan/zoom animations).

## Google Photos

The Google Photos integration allows you to display photos from your Google Photos library on the Skylite UX Home screen. You can select specific albums to display, and photos will cycle through with smooth transitions and Ken Burns effects.

### Capabilities

- **Get albums**: List all albums from your Google Photos library
- **Get photos**: Retrieve photos from selected albums
- **OAuth authentication**: Secure authentication using Google OAuth
- **Album selection**: Choose which albums to display on the Home screen
- **Multi-user support**: Multiple users can connect their Google Photos accounts

### Setup Instructions

#### Administrator Setup (One-Time)

Before users can connect their Google Photos, an administrator must configure OAuth credentials and enable the Photos Library API.

**Note:** If you've already set up Google Calendar integration, you can reuse the same OAuth credentials. You just need to enable the Photos Library API and add the Photos scope.

##### Step 1: Enable the Photos Library API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your existing project (or create a new one)
3. Navigate to **APIs & Services > Library**
4. Search for **"Photos Library API"**
5. Click on it and click **Enable**
6. **Important**: Make sure you see "MANAGE" (not "ENABLE") after clicking - this confirms the API is enabled

##### Step 2: Add the Photos OAuth Scope

1. Go to **APIs & Services > OAuth consent screen**
2. Click **Edit App**
3. Navigate to the **Scopes** section
4. Click **Add or Remove Scopes**
5. Search for and add: `https://www.googleapis.com/auth/photoslibrary.readonly`
6. Click **Update** and then **Save and Continue**

##### Step 2b: Add Test Users (if app is in Testing mode)

The `photoslibrary.readonly` scope is a "restricted" scope. If your app's publishing status is "Testing" (not "In production"), you must add users as test users:

1. On the **OAuth consent screen** page, check the "Publishing status"
2. If it says "Testing", scroll down to the **Test users** section
3. Click **Add Users**
4. Add the email addresses of users who will connect their Google Photos
5. Click **Save**

**Note:** Only test users can access restricted scopes like Photos Library when the app is in Testing mode.

##### Step 3: Add the Redirect URI (if not already done)

1. Go to **APIs & Services > Credentials**
2. Click on your existing **OAuth 2.0 Client ID**
3. Under **Authorized redirect URIs**, add:
   - For local development: `http://localhost:3000/api/integrations/google_photos/callback`
   - For production: `https://your-domain.com/api/integrations/google_photos/callback`
4. Click **Save**

##### Step 4: Configure Environment Variables (if not already done)

If you haven't already configured Google OAuth for Calendar:

1. Copy the **Client ID** and **Client Secret** from your OAuth credentials
2. Add them to your environment:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```
3. For Docker deployments, pass as environment variables:
   ```bash
   docker run -e GOOGLE_CLIENT_ID=xxx -e GOOGLE_CLIENT_SECRET=xxx ...
   ```

#### User Setup

Once the administrator has configured the OAuth credentials:

1. In Skylite UX, go to **Settings > Integrations > Add Integration**
2. Select **Photos** as the type and **Google** as the service
3. Give the integration a name (e.g., "My Google Photos")
4. Click **Save** - you will be redirected to Google to sign in
5. Sign in with your Google account and grant photo library access
6. After authorization, you will be redirected back to Skylite UX

#### Selecting Albums

After connecting Google Photos:

1. Navigate to the **Home** page
2. Click the **Settings** icon (gear) in the top-right corner
3. In the **Photo Background** section, click on your connected Google Photos account
4. The account will expand to show all your albums
5. Check the albums you want to display on the Home screen
6. Click **Save Album Selection**

**Tip:** If you leave no albums selected, the Home screen will display your most recent photos from all albums.

---

### Home Screen Features

The Home screen displays your photos with several customizable features:

- **Ken Burns Effect**: Photos pan and zoom smoothly for a dynamic display
- **Transition Speed**: Adjustable from 5 to 30 seconds per photo
- **Ken Burns Intensity**: Adjustable from subtle to dramatic movement
- **Overlay Widgets**: Display clock, weather, events, todos, meals, and countdown timers

### Troubleshooting

- **"Google Photos not configured"**: The administrator needs to set the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables

- **"redirect_uri_mismatch" error**: Ensure the redirect URI is correctly configured in Google Cloud Console:
  - `http://localhost:3000/api/integrations/google_photos/callback` (development)
  - `https://your-domain.com/api/integrations/google_photos/callback` (production)

- **Google only asks for Calendar permission, not Photos**:
  This means the `photoslibrary.readonly` scope is not added to your OAuth consent screen:
  1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **OAuth consent screen**
  2. If your app is in "Testing" mode, click **Edit App** and proceed to the **Scopes** section
  3. If you don't see "Edit App", look for a **Scopes** section on the page
  4. Click **Add or Remove Scopes**
  5. In the search/filter box, paste: `https://www.googleapis.com/auth/photoslibrary.readonly`
  6. Check the box next to it and click **Update**, then **Save and Continue**
  7. Delete your existing Google Photos integration in Skylite UX
  8. Re-add it - Google should now ask for Photos permission

- **"403 Forbidden" or "Permission denied" or "insufficient authentication scopes" when fetching albums**:
  1. Verify the **Photos Library API** is enabled in Google Cloud Console → APIs & Services → Library (must show "MANAGE", not "ENABLE")
  2. Verify the `photoslibrary.readonly` scope is added to the OAuth consent screen
  3. **If app is in "Testing" mode**: Add your Google account email as a Test User in the OAuth consent screen
  4. **Important**: After making any changes, you must delete and re-add the integration to get a new token with the correct permissions

- **"Authentication expired" or "Reauth required"**: Click on the integration in Settings and save again to re-authorize

- **No photos appearing**:
  1. Ensure you have selected albums in the Home Settings
  2. Verify the selected albums contain photos (not just videos)
  3. Check that the integration is enabled in Settings > Integrations

- **Photos not updating**: The Home screen caches photos. Refresh the page or wait for the next sync cycle

- **Server logs show "Photos scope NOT granted"**: This confirms the scope is missing from your OAuth consent screen. Follow the steps above to add it.

- **Server logs show token has correct scope but API returns 403**: This usually means your app is in "Testing" mode and you're not listed as a test user. Go to OAuth consent screen → Test users → Add your email.
