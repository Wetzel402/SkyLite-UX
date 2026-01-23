# Google Tasks API Endpoints

This document describes the API endpoints for the Google Tasks integration.

## Authentication Endpoints

### GET /api/integrations/google_tasks/authorize

Initiates OAuth flow for Google Tasks.

**Description**: Redirects the user to Google's OAuth consent screen to authorize access to their Google Tasks.

**Authentication**: None required (public endpoint)

**Parameters**: None

**Response**: HTTP 302 Redirect to Google OAuth consent screen

**Example**:

```javascript
// Redirect to authorization page
window.location.href = "/api/integrations/google_tasks/authorize";
```

---

### GET /api/integrations/google_tasks/callback

OAuth callback endpoint.

**Description**: Handles the OAuth callback from Google after user authorization. Exchanges the authorization code for access and refresh tokens, then stores them in the database.

**Authentication**: None required (OAuth callback)

**Query Parameters**:

- `code` (string, required): Authorization code from Google

**Response**: HTTP 302 Redirect to `/settings?success=google_tasks_added&integrationId={id}`

**Error Responses**:

- `400 Bad Request`: Missing or invalid authorization code
- `500 Internal Server Error`: OAuth credentials not configured or token exchange failed

**Example**:

```http
GET /api/integrations/google_tasks/callback?code=4/0AY0e-g7...
```

---

## Data Endpoints

### GET /api/integrations/google_tasks/all-tasks

Fetches all incomplete tasks from all task lists.

**Description**: Returns all incomplete (not completed) tasks from all of the user's Google Tasks lists. Only fetches tasks where status is "needsAction".

**Authentication**: Requires Google Tasks integration to be enabled

**Parameters**: None

**Response**: JSON object with tasks array

**Response Schema**:

```typescript
{
  tasks: Array<{
    id: string; // Google Task ID
    title: string; // Task title
    notes?: string | null; // Task notes/description
    status: "needsAction" | "completed";
    due?: string | null; // ISO 8601 date string
    completed?: string | null; // ISO 8601 date string
    updated: string; // ISO 8601 date string
    taskListId: string; // ID of the task list containing this task
  }>;
}
```

**Success Response Example**:

```json
{
  "tasks": [
    {
      "id": "MTIzNDU2Nzg5MDEyMzQ1Njc4OTA",
      "title": "Buy groceries",
      "notes": "Milk, bread, eggs",
      "status": "needsAction",
      "due": "2025-01-25T00:00:00.000Z",
      "updated": "2025-01-22T10:30:00.000Z",
      "taskListId": "MTIzNDU2Nzg5MDEyMzQ1Njc4OTA"
    },
    {
      "id": "OTg3NjU0MzIxMDk4NzY1NDMyMQ",
      "title": "Call dentist",
      "status": "needsAction",
      "due": "2025-01-26T00:00:00.000Z",
      "updated": "2025-01-22T11:00:00.000Z",
      "taskListId": "MTIzNDU2Nzg5MDEyMzQ1Njc4OTA"
    }
  ]
}
```

**Empty Response Example**:

```json
{
  "tasks": []
}
```

**Error Handling**:

- Returns empty tasks array if integration is not enabled
- Returns empty tasks array if integration credentials are not configured
- Returns empty tasks array if API call fails
- Automatically refreshes expired access tokens

**Example Usage**:

```javascript
const response = await fetch("/api/integrations/google_tasks/all-tasks");
const data = await response.json();
// data.tasks contains the task list
```

---

### GET /api/integrations/google_calendar/reminders

Fetches short calendar events (reminders).

**Description**: Returns short calendar events (1 hour or less in duration) from selected Google Calendar calendars. These are typically reminders or quick events.

**Authentication**: Requires Google Calendar integration to be enabled

**Parameters**: None

**Response**: JSON object with reminders array

**Response Schema**:

```typescript
{
  reminders: Array<{
    id: string; // Google Calendar event ID
    title: string; // Event summary/title
    description?: string | null; // Event description
    dueDate: string; // ISO 8601 date/time string (event start time)
  }>;
}
```

**Success Response Example**:

```json
{
  "reminders": [
    {
      "id": "abc123def456",
      "title": "Team standup",
      "description": "Daily team meeting",
      "dueDate": "2025-01-22T09:00:00.000Z"
    },
    {
      "id": "xyz789uvw012",
      "title": "Submit report",
      "dueDate": "2025-01-22T17:00:00.000Z"
    }
  ]
}
```

**Empty Response Example**:

```json
{
  "reminders": []
}
```

**Filtering Logic**:

- Only includes events with duration ≤ 1 hour (3600000 milliseconds)
- Only fetches from calendars selected in integration settings
- Returns empty array if no calendars are selected

**Error Handling**:

- Returns empty reminders array if integration is not enabled
- Returns empty reminders array if integration credentials are not configured
- Returns empty reminders array if API call fails
- Automatically refreshes expired access tokens

**Example Usage**:

```javascript
const response = await fetch("/api/integrations/google_calendar/reminders");
const data = await response.json();
// data.reminders contains the reminder list
```

---

## Integration Status

To check if Google Tasks integration is enabled, use the general integrations endpoint:

```javascript
const response = await fetch("/api/integrations");
const integrations = await response.json();
const googleTasks = integrations.find(
  i => i.type === "tasks" && i.service === "google"
);
// Check googleTasks?.enabled to see if integration is active
```

---

## Error Codes

| Status Code | Description                                                   |
| ----------- | ------------------------------------------------------------- |
| 200         | Success                                                       |
| 400         | Bad Request (missing required parameters)                     |
| 404         | Integration not found                                         |
| 500         | Internal Server Error (OAuth config missing, API error, etc.) |

---

## Rate Limiting

Google Tasks API has the following quotas:

- Queries per day: 1,000,000
- Queries per 100 seconds per user: 50,000

If you exceed these limits, the API will return a 429 (Too Many Requests) error.

---

## Token Management

All endpoints automatically handle token refresh:

- Access tokens are cached in Integration.settings.accessToken
- Refresh tokens are stored in Integration.apiKey
- Tokens are automatically refreshed 30 seconds before expiry
- If refresh fails, user must re-authorize the integration

---

## Security Considerations

1. **OAuth Tokens**: Never expose OAuth credentials in client-side code
2. **API Endpoints**: All Google API calls are made server-side
3. **Database Storage**: Refresh tokens are stored encrypted in the database
4. **HTTPS**: All OAuth redirects and API calls use HTTPS

---

## Testing

To test the Google Tasks integration:

1. **Setup**: Configure OAuth credentials in `.env`
2. **Authorization**: Navigate to `/api/integrations/google_tasks/authorize`
3. **Verify Callback**: Should redirect to `/settings?success=google_tasks_added`
4. **Fetch Tasks**: Call `/api/integrations/google_tasks/all-tasks`
5. **Verify Data**: Check that tasks array contains your Google Tasks

---

## Troubleshooting

### Empty tasks array

- Verify integration is enabled in database
- Check that OAuth credentials are configured
- Ensure user has authorized the integration
- Verify user has tasks in Google Tasks app

### 403 Forbidden

- Token may have expired - re-authorize integration
- Check OAuth scopes include `https://www.googleapis.com/auth/tasks`

### 500 Internal Server Error

- Check server logs for detailed error messages
- Verify OAuth credentials are valid
- Ensure database connection is working
