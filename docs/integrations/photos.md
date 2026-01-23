---
title: Photos
parent: Integrations
layout: default
nav_order: 5
permalink: /integrations/photos/
---

# Photos

Photo integrations allow you to connect external photo services to Skylite UX. Photos are displayed on the Home screen as a beautiful ambient slideshow with Ken Burns effect (pan/zoom animations).

## Google Photos (Photos Picker API)

The Google Photos integration uses the **Photos Picker API** to allow users to select specific albums for display on the Skylite UX Home screen. This approach is more privacy-friendly and doesn't require sensitive OAuth scopes.

**Home Screen Features**:

- Photos display with smooth Ken Burns effect (pan and zoom animation)
- Configurable transition speed (5-60 seconds)
- Adjustable animation intensity (0.5x - 2.0x)
- Semi-transparent text overlays ensure widget readability on all photos

**Important:** As of March 31, 2025, Google deprecated the `photoslibrary.readonly` OAuth scope. The old Library API approach no longer works.

### How It Works

1. **User Selection**: Users click "Select Albums" in Settings
2. **Picker Opens**: Google's Photos Picker modal displays user's albums
3. **Albums Saved**: Selected albums are stored in the database
4. **Display**: Home page cycles through photos from selected albums

### Capabilities

- **Album selection**: Choose specific albums via Google's picker interface
- **No sensitive scopes**: Picker handles authentication automatically
- **User control**: Explicit selection of which albums to display
- **Privacy-friendly**: No broad access to entire photo library

### Setup Instructions

#### Administrator Setup (One-Time)

The Photos Picker API requires minimal setup - no special OAuth scopes or API restrictions are needed.

##### Step 1: Enable the Google Picker API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your existing project (or create a new one)
3. Navigate to **APIs & Services > Library**
4. Search for **"Google Picker API"**
5. Click on it and click **Enable**

**Note:** You can reuse the same OAuth credentials that you use for Google Calendar integration. No separate credentials are needed.

##### Step 2: Verify OAuth Credentials (if not already configured)

If you haven't already configured Google OAuth credentials for Calendar:

1. Go to **APIs & Services > Credentials**
2. Create an **OAuth 2.0 Client ID** (if you don't have one)
3. Application type: **Web application**
4. Add authorized redirect URIs:
   - For local development: `http://localhost:3000/api/integrations/google_calendar/callback`
   - For production: `https://your-domain.com/api/integrations/google_calendar/callback`

##### Step 3: Configure Environment Variables

Add your OAuth credentials to the environment:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

For Docker deployments:

```bash
docker run -e GOOGLE_CLIENT_ID=xxx -e GOOGLE_CLIENT_SECRET=xxx ...
```

#### User Setup

##### Selecting Albums

1. In Skylite UX, go to **Settings**
2. Scroll to the **Home Page** section
3. Ensure **Photo Slideshow** is enabled
4. Click **Select Albums** button
5. Google's Photos Picker will open with your albums
6. Select the albums you want to display
7. Click **Done** in the picker
8. Selected albums will appear in the list

##### Managing Albums

- **View selected albums**: See all selected albums with cover photos in Settings
- **Remove albums**: Click the trash icon next to any album to remove it
- **Add more albums**: Click "Select Albums" again to add additional albums

---

### Home Screen Features

The Home screen displays your photos with several customizable features:

- **Ken Burns Effect**: Photos pan and zoom smoothly for a dynamic display (adjustable 0-2x intensity)
- **Transition Speed**: Adjustable from 5 to 60 seconds per photo
- **Empty State**: Displays a message with link to settings when no albums are selected
- **Overlay Widgets**: Display clock, weather, events, todos, meals, and countdown timers

### Configuration Options

Available in **Settings > Home Page**:

| Setting             | Description                     | Range                         |
| ------------------- | ------------------------------- | ----------------------------- |
| Photo Slideshow     | Enable/disable photo background | On/Off                        |
| Selected Albums     | Albums to display               | Multiple selection            |
| Transition Speed    | Time between photo changes      | 5-60 seconds                  |
| Ken Burns Intensity | Pan/zoom effect strength        | 0-2.0x (0 = off, 2 = maximum) |

### Troubleshooting

**"No Photos Selected" message on Home page**

- Go to Settings > Home Page
- Click "Select Albums"
- Choose at least one album from the picker

**Picker doesn't open**

- Check browser console for errors
- Ensure Google Picker API is enabled in Google Cloud Console
- Verify `GOOGLE_CLIENT_ID` is set in environment variables
- Try refreshing the page

**Albums not saving**

- Check browser network tab for API errors
- Verify database migration ran successfully
- Check server logs for errors

**Photos not displaying**

- Ensure Photo Slideshow is enabled in Settings
- Verify you have selected at least one album
- Check that selected albums contain photos (not just videos)
- Refresh the Home page

**"Google Picker not loaded" error**

- Check that the Google Picker API script is loading
- Verify there are no browser extensions blocking the script
- Check browser console for loading errors

### Differences from Old Implementation

**Old (OAuth-based Library API):**

- ❌ Required `photoslibrary.readonly` scope (deprecated March 31, 2025)
- ❌ Needed OAuth consent screen configuration
- ❌ Required test users for sensitive scope
- ❌ Complex token management
- ❌ 403 errors after deprecation date

**New (Photos Picker API):**

- ✅ No sensitive scopes needed
- ✅ Google handles authentication
- ✅ Explicit user control over album selection
- ✅ More privacy-friendly
- ✅ Works after deprecation date
- ✅ Simpler setup process

### Privacy & Security

The Photos Picker API is designed with privacy in mind:

- **User consent**: Users explicitly select which albums to share
- **No broad access**: Only selected albums are accessible
- **Google authentication**: Picker handles auth securely
- **No token storage**: No need to store sensitive OAuth tokens for photos

### Technical Details

**Database Schema:**

Selected albums are stored in the `selected_albums` table with:

- Album ID (from Google Photos)
- Album title
- Cover photo URL
- Media items count
- Display order

**API Endpoints:**

- `GET /api/selected-albums` - Fetch user's selected albums
- `POST /api/selected-albums` - Save album selections
- `DELETE /api/selected-albums/[id]` - Remove an album

**Client-Side:**

- `usePhotosPicker` composable - Album selection logic
- `usePhotos` composable - Photo fetching for display
- Google Picker plugin - Loads Picker API

---

For more help, see the [Troubleshooting Guide](#troubleshooting) or check the server logs for detailed error messages.
