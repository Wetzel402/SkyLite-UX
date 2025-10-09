# Docker Setup for SkyLite-UX

This guide explains how to run SkyLite-UX using Docker Compose for easy deployment and self-hosting.

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/rottenlawns/SkyLite-UX-custom.git
   cd SkyLite-UX-custom
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Open your browser to `http://localhost:3000`
   - The application will be available on port 3000

## Services

### PostgreSQL Database
- **Container**: `skylite-postgres`
- **Port**: 5432 (internal)
- **Database**: `skylite`
- **User**: `skylite`
- **Password**: Set via `POSTGRES_PASSWORD` environment variable

### SkyLite-UX Application
- **Container**: `skylite-app`
- **Port**: 3000 (exposed)
- **Health Check**: Available at `/api/health`

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database Configuration
DATABASE_URL=postgresql://skylite:skylite_password@postgres:5432/skylite
POSTGRES_PASSWORD=skylite_password

# Application Configuration
NODE_ENV=production
NUXT_PUBLIC_LOG_LEVEL=info
NUXT_PUBLIC_TZ=America/Chicago
```

## Persistent Data

The following data is persisted using Docker volumes:

- **PostgreSQL data**: `postgres_data` volume
- **Application data**: `app_data` volume

## Management Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f skylite-app
```

### Restart services
```bash
docker-compose restart
```

### Update application
```bash
docker-compose pull
docker-compose up -d
```

### Run smoke tests
```bash
# Test events API endpoint
docker-compose exec skylite-app npm run smoke:events

# Test sync functionality
docker-compose exec skylite-app npm run smoke
```

## Database Management

### Access PostgreSQL directly
```bash
docker-compose exec postgres psql -U skylite -d skylite
```

### Run database migrations
```bash
docker-compose exec skylite-app npx prisma migrate deploy
```

### Generate Prisma client
```bash
docker-compose exec skylite-app npx prisma generate
```

## Unraid Deployment

For Unraid users, see [UNRAID.md](./UNRAID.md) for specific deployment instructions.

**Important**: Unraid doesn't handle CLI-based container modifications well. Always use the Unraid web interface or Docker Compose for management.

### Unraid-Specific Notes

- **Storage**: Use `/mnt/user/appdata/skylite-ux/` for application data
- **Network**: Bridge mode recommended for most setups
- **Updates**: Use `docker-compose pull && docker-compose up -d` for updates
- **Backups**: Include both application data and database volumes

## Troubleshooting

### Check service status
```bash
docker-compose ps
```

### Check health status
```bash
curl http://localhost:3000/api/health
```

### View detailed logs
```bash
docker-compose logs --tail=100 skylite-app
```

### Reset everything (⚠️ This will delete all data)
```bash
docker-compose down -v
docker-compose up -d
```

## Production Considerations

1. **Change default passwords** in your `.env` file
2. **Use a reverse proxy** (nginx, traefik) for SSL termination
3. **Set up regular backups** of the PostgreSQL volume
4. **Monitor resource usage** and adjust container limits
5. **Use Docker secrets** for sensitive data in production

## Unraid Deployment

For Unraid users, you can use the Docker Compose file directly in the Unraid Docker interface:

1. Go to **Docker** → **Add Container**
2. Select **Use a template** → **Custom**
3. Copy the contents of `docker-compose.yml`
4. Configure your environment variables
5. Deploy the stack

## Kiosk Mode Setup

SkyLite-UX includes a special **Kiosk Mode** designed for wall displays and tablets. This mode provides a clean, touch-friendly interface perfect for family calendar displays.

### Enabling Kiosk Mode

1. **Set environment variables** in your `.env` file:
   ```bash
   ENABLE_KIOSK_MODE=true
   DISPLAY_TOKEN=your-secure-display-token-here
   ```

2. **Restart the application**:
   ```bash
   docker-compose restart skylite-app
   ```

3. **Access kiosk mode**:
   - Navigate to `http://localhost:3000/display?token=your-secure-display-token-here`
   - The interface will automatically refresh every 60 seconds
   - Perfect for tablets or wall-mounted displays

### Security Configuration

#### Display Token Setup
```bash
# Generate a secure token (recommended)
openssl rand -hex 32

# Set in your .env file
DISPLAY_TOKEN=your-generated-token-here
```

#### Production Security
- **Always use HTTPS** in production
- **Set strong display tokens** (minimum 8 characters)
- **Use reverse proxy** (NGINX, Traefik, Cloudflare)
- **Monitor access logs** for security events

### Kiosk Mode Features

- **📅 Weekly Calendar View** - Shows current week with color-coded events
- **🔄 Auto-refresh** - Updates every 60 seconds automatically
- **📱 Touch-friendly** - Large buttons and text for easy interaction
- **🌐 Offline Support** - Works even when internet connection is lost
- **⏰ Live Clock** - Shows current date and time prominently
- **👥 Family Colors** - Each family member has their own color coding

### Wall Display Setup

For optimal wall display experience:

1. **Use a tablet or touchscreen monitor**
2. **Set browser to fullscreen mode** (F11 or kiosk mode)
3. **Disable screen sleep** in device settings
4. **Use landscape orientation** for best calendar view
5. **Connect to power** for continuous operation

### PWA Installation

The kiosk mode can be installed as a Progressive Web App (PWA):

1. **Open** `http://localhost:3000/display` in your browser
2. **Look for** the "Install" button in your browser
3. **Install** the app to your device's home screen
4. **Launch** the app for a native-like experience

### Offline Functionality

- **Cached Data** - Calendar events are cached for offline viewing
- **Auto-sync** - Data refreshes when connection is restored
- **Fallback UI** - Shows offline message when no cached data available
- **Background Updates** - Service worker handles data synchronization

### Troubleshooting Kiosk Mode

**Kiosk mode not loading?**
```bash
# Check if kiosk mode is enabled
docker-compose exec skylite-app printenv ENABLE_KIOSK_MODE
```

**Events not showing?**
```bash
# Check API endpoint
curl http://localhost:3000/api/events/week
```

**Offline mode not working?**
- Ensure service worker is registered (check browser dev tools)
- Clear browser cache and reload
- Check network connectivity

### Reverse Proxy Configuration

#### NGINX Example
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy no-referrer;
    
    # Kiosk mode - cache only read-only endpoints
    location /display {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache kiosk display
        proxy_cache_valid 200 30s;
        proxy_cache_bypass $http_pragma $http_authorization;
    }
    
    location /api/events/week {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache API responses
        proxy_cache_valid 200 30s;
        proxy_cache_bypass $http_pragma $http_authorization;
    }
    
    # Block sensitive endpoints
    location /api/users {
        return 404;
    }
    
    location /api/integrations {
        return 404;
    }
    
    # Main application
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # No caching for main app
        proxy_cache off;
    }
}
```

#### Cloudflare Configuration
```javascript
// Cloudflare Workers script
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Kiosk mode caching
  if (url.pathname === '/display' || url.pathname === '/api/events/week') {
    const cache = caches.default
    let response = await cache.match(request)
    
    if (!response) {
      response = await fetch(request)
      // Cache for 30 seconds
      const responseToCache = response.clone()
      responseToCache.headers.set('Cache-Control', 'public, max-age=30')
      event.waitUntil(cache.put(request, responseToCache))
    }
    
    return response
  }
  
  // Block sensitive endpoints
  if (url.pathname.startsWith('/api/users') || 
      url.pathname.startsWith('/api/integrations')) {
    return new Response('Not Found', { status: 404 })
  }
  
  return fetch(request)
}
```

## Testing

### Running Tests Locally

#### Prerequisites
```bash
# Install dependencies
npm ci

# Install Playwright browsers
npx playwright install --with-deps
```

#### Test Commands
```bash
# Run all tests (unit + e2e)
npm run test

# Run unit tests only
npm run test:unit

# Run E2E tests only
npm run test:e2e

# Run tests with build (recommended)
make test-all
```

#### Development Testing
```bash
# Start development server and run E2E tests
make dev-test-e2e

# Simulate CI pipeline locally
make ci-simulate
```

#### Docker Testing
```bash
# Start services for testing
make docker-dev

# Run tests in Docker
make docker-test

# Stop services
make docker-stop
```

### Test Data

The test suite uses deterministic test data to ensure consistent results:

- **3 test users** with different colors
- **5 calendar events** spanning the current week
- **1 shopping list** with 4 items
- **Current week focus** - events are generated for the current week

### CI Pipeline

The project includes a comprehensive CI pipeline that runs on every push and pull request:

1. **Typecheck** - TypeScript type checking
2. **Lint** - ESLint code quality checks
3. **Build** - Application build verification
4. **Unit Tests** - Vitest unit test suite
5. **E2E Tests** - Playwright end-to-end tests
6. **Test Data Seeding** - Database seeding for tests

### Test Configuration

#### Environment Variables
```bash
NODE_ENV=test
DATABASE_URL=postgres://postgres:postgres@localhost:5432/skylite_test
ENABLE_KIOSK_MODE=true
DISPLAY_TOKEN=test-token-123
```

#### Test Database
- **Separate test database** - `skylite_test`
- **Automatic seeding** - Test data created automatically
- **Isolated tests** - Each test run starts with clean data

## Phase 1: ICS Calendar Sync (Read-Only)

SkyLite-UX now supports importing calendar events from external ICS feeds. This is a read-only implementation that establishes the foundation for future CalDAV integration.

### Configuration

Add the following environment variables to your `.env` file:

```bash
# Enable calendar sync
CALENDAR_SYNC_ENABLED=true

# ICS feeds configuration (JSON array)
ICS_FEEDS='[
  {
    "name": "Family Calendar",
    "color": "#4C6FFF",
    "url": "https://example.com/family.ics"
  },
  {
    "name": "School Events",
    "color": "#E85D04", 
    "url": "https://example.com/school.ics"
  }
]'

# Sync interval in seconds (default: 900 = 15 minutes)
ICS_SYNC_INTERVAL_SECONDS=900
```

### Supported ICS Sources

- **Google Calendar** - Export public calendar as ICS
- **Nextcloud Calendar** - Public ICS feed URL
- **Outlook Calendar** - Export as ICS file
- **Apple Calendar** - Export as ICS file
- **Any ICS-compliant calendar** - Standard iCalendar format

### Features

- **Automatic Sync** - Background synchronization every 15 minutes
- **Conditional Requests** - Respects 304 Not Modified responses
- **Error Handling** - Graceful handling of network errors and invalid feeds
- **Color Coding** - Each feed can have its own color
- **Source Attribution** - Events show their source calendar name
- **Timezone Support** - Proper UTC conversion and display

### Limitations (Phase 1)

- **Read-Only** - No write access to external calendars
- **Limited RRULE** - Basic recurrence rules only (DAILY/WEEKLY)
- **No Authentication** - Public ICS feeds only
- **No Real-time** - Sync happens on schedule, not immediately

### Example Setup

1. **Google Calendar**:
   - Go to Google Calendar settings
   - Find your calendar → Access permissions
   - Make it public
   - Copy the public ICS URL
   - Add to `ICS_FEEDS` configuration

2. **Nextcloud Calendar**:
   - Go to Calendar app in Nextcloud
   - Click on calendar settings
   - Copy the public link
   - Add to `ICS_FEEDS` configuration

### Troubleshooting

- **Sync Not Working**: Check that URLs are publicly accessible
- **Events Not Appearing**: Verify ICS format and timezone settings
- **Performance Issues**: Increase `ICS_SYNC_INTERVAL_SECONDS` for less frequent sync
- **Color Issues**: Ensure color values are valid hex codes

## Phase 2: CalDAV (Read-Only)

SkyLite-UX now supports CalDAV integration for reading events from CalDAV servers like Nextcloud, Radicale, iCloud, Fastmail, and Google Calendar via CalDAV.

### Configuration

Add the following environment variables to your `.env` file:

```bash
# Enable CalDAV sync
CALDAV_SYNC_ENABLED=true

# CalDAV accounts configuration (JSON array)
CALDAV_ACCOUNTS='[
  {
    "name": "Family Nextcloud",
    "serverUrl": "https://nc.example.com/remote.php/dav",
    "username": "alice",
    "password": "your-password",
    "color": "#2E7D32",
    "calendarName": "Personal"
  },
  {
    "name": "Work Calendar",
    "serverUrl": "https://caldav.fastmail.com/dav/calendars/user/username/",
    "username": "user@fastmail.com",
    "password": "app-password",
    "color": "#E85D04"
  }
]'

# Sync interval in seconds (default: 300 = 5 minutes)
CALDAV_SYNC_INTERVAL_SECONDS=300
```

### Supported CalDAV Servers

#### Nextcloud
```bash
# Server URL format
"serverUrl": "https://your-nextcloud.com/remote.php/dav"

# Example configuration
{
  "name": "Family Nextcloud",
  "serverUrl": "https://nc.example.com/remote.php/dav",
  "username": "alice",
  "password": "your-password",
  "color": "#2E7D32",
  "calendarName": "Personal"  # Optional: filter specific calendar
}
```

#### iCloud
```bash
# Use app-specific password (not your Apple ID password)
{
  "name": "iCloud Calendar",
  "serverUrl": "https://caldav.icloud.com",
  "username": "your-email@icloud.com",
  "password": "app-specific-password",
  "color": "#007AFF"
}
```

#### Fastmail
```bash
# Use app password (not your regular password)
{
  "name": "Fastmail Calendar",
  "serverUrl": "https://caldav.fastmail.com/dav/calendars/user/username/",
  "username": "user@fastmail.com",
  "password": "app-password",
  "color": "#FF6B35"
}
```

#### Google Calendar (via CalDAV)
```bash
# Use app password (not your Google account password)
{
  "name": "Google Calendar",
  "serverUrl": "https://caldav.google.com/dav/",
  "username": "your-email@gmail.com",
  "password": "app-password",
  "color": "#4285F4"
}
```

#### Radicale
```bash
# Self-hosted Radicale server
{
  "name": "Radicale Calendar",
  "serverUrl": "https://radicale.example.com",
  "username": "user",
  "password": "password",
  "color": "#8B5CF6"
}
```

### Security Best Practices

#### App Passwords
- **Never use your main account password**
- **Use app-specific passwords** for all services
- **Rotate passwords regularly**
- **Use strong, unique passwords**

#### Environment Security
```bash
# Never commit credentials to version control
echo "CALDAV_ACCOUNTS=..." >> .env
echo ".env" >> .gitignore

# Use Docker secrets in production
docker secret create caldav_creds caldav_credentials.json
```

#### Credential Masking
- **Logs never show full passwords** - only masked versions
- **Username masking** - shows first 2 and last 2 characters
- **Error messages** - don't expose sensitive information

### Features

- **Multi-Server Support** - Connect to multiple CalDAV servers
- **Calendar Discovery** - Automatically finds available calendars
- **Calendar Filtering** - Optional filtering by calendar name
- **Time Window Sync** - Fetches events for current week ± 2 days
- **Error Isolation** - One server failure doesn't affect others
- **Credential Security** - Passwords never logged or exposed
- **Source Attribution** - Events show their source server and calendar

### Limitations (Phase 2)

- **Read-Only** - No write access to CalDAV servers
- **Basic RRULE** - Limited recurrence rule expansion
- **No Real-time** - Sync happens on schedule (5 minutes default)
- **No OAuth** - Username/password authentication only
- **No Conflict Resolution** - Local events take priority

## Phase 3: Two-way CalDAV (Experimental)

⚠️ **WARNING: This is an experimental feature. Use with caution in production environments.**

SkyLite-UX now supports two-way CalDAV synchronization, allowing you to create, update, and delete events on CalDAV servers. This feature is behind strict feature flags and requires careful configuration.

### ⚠️ Important Safety Notes

- **Backup your database** before enabling write operations
- **Test in a development environment** first
- **Monitor audit logs** for any issues
- **Use dry-run mode** to test operations safely
- **Writes are disabled by default** - must be explicitly enabled

### Configuration

Add the following environment variables to enable CalDAV write operations:

```bash
# Enable CalDAV write operations (REQUIRED)
CALDAV_WRITE_ENABLED=true

# Enable dry-run mode for testing (RECOMMENDED for initial setup)
CALDAV_DRY_RUN=true

# Default write policy for new sources (none = read-only, write = allow writes)
CALDAV_WRITE_DEFAULT_POLICY=none

# Admin API token for write operations (REQUIRED)
ADMIN_API_TOKEN=your-secure-admin-token-here
```

### Enabling Write Access for Sources

Write operations require **both** global enablement and per-source permission:

1. **Global Enablement**: Set `CALDAV_WRITE_ENABLED=true`
2. **Source Permission**: Set `writePolicy='write'` for specific sources

```bash
# Example: Enable writes for a specific CalDAV source
# This would typically be done via database update or admin UI
UPDATE calendar_sources 
SET writePolicy = 'write' 
WHERE id = 'your-source-id' AND type = 'caldav';
```

### Admin API Endpoints

The write operations are available via admin API endpoints:

#### Create Event
```bash
curl -X POST http://localhost:3000/api/admin/events \
  -H "X-Admin-Token: your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Event",
    "description": "Event description",
    "location": "Event location",
    "start": "2024-01-01T10:00:00Z",
    "end": "2024-01-01T11:00:00Z",
    "allDay": false,
    "sourceId": "your-caldav-source-id"
  }'
```

#### Update Event
```bash
curl -X PATCH http://localhost:3000/api/admin/events/event-id \
  -H "X-Admin-Token: your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Event Title",
    "description": "Updated description"
  }'
```

#### Delete Event
```bash
curl -X DELETE http://localhost:3000/api/admin/events/event-id \
  -H "X-Admin-Token: your-admin-token"
```

### Write Operations Flow

#### Create Event
1. **Local Creation**: Event created in database with `status='pending'`
2. **Remote Sync**: If writes allowed, event created on CalDAV server
3. **Confirmation**: Local event updated with remote UID and ETag
4. **Audit Trail**: Complete audit log of the operation

#### Update Event
1. **Conflict Check**: Uses `If-Match` header with stored ETag
2. **Optimistic Concurrency**: Fails with 409 if event was modified remotely
3. **Version Increment**: Local version number incremented
4. **Audit Trail**: Before/after state recorded

#### Delete Event
1. **Soft Delete**: Creates tombstone record, marks as `cancelled`
2. **Remote Delete**: Attempts to delete from CalDAV server
3. **Graceful Handling**: Treats 404 as success (already deleted)
4. **Audit Trail**: Deletion recorded with timestamp

### Conflict Resolution

The system uses optimistic concurrency control:

- **ETag-based**: Each event has a `lastRemoteEtag` for conflict detection
- **If-Match Headers**: All updates/deletes include ETag validation
- **409 Conflicts**: Returns conflict details when ETags don't match
- **No Overwrites**: Never overwrites remote changes without explicit resolution

### Quota Management

Write operations are rate-limited per source:

- **30 writes per minute** per source (configurable)
- **Token bucket algorithm** for smooth rate limiting
- **429 responses** when quota exceeded
- **Automatic cleanup** of old quota buckets

### Retry Logic

Network operations include automatic retry:

- **Exponential backoff** for 5xx server errors
- **No retry** for 4xx client errors (except 409 conflicts)
- **Maximum 3 retries** with increasing delays
- **Conflict errors** bubble up immediately

### Dry-Run Mode

Test write operations safely:

```bash
# Enable dry-run mode
CALDAV_DRY_RUN=true

# Operations will:
# - Create audit entries
# - Log what would be done
# - Return success responses
# - NOT modify remote calendars
```

### Audit and Monitoring

All write operations are fully audited:

#### CalendarAudit Table
- **Operation Type**: `create`, `update`, `delete`
- **Actor**: `user` (admin API) or `system` (sync)
- **Before/After State**: Complete event snapshots
- **Timestamps**: Precise operation timing

#### Monitoring Commands
```bash
# View recent write operations
docker-compose exec skylite-app npx prisma studio
# Navigate to CalendarAudit table

# Check quota status
curl -H "X-Admin-Token: your-token" http://localhost:3000/api/admin/sources

# Monitor logs
docker-compose logs skylite-app | grep -i "CalDAV Write"
```

### Security Considerations

#### Authentication
- **Admin API Token**: Required for all write operations
- **Source Credentials**: Stored securely, never logged
- **HTTPS Only**: All CalDAV connections must use HTTPS

#### Authorization
- **Per-Source Permissions**: `writePolicy` field controls access
- **Global Flags**: Multiple layers of write protection
- **Audit Trail**: Complete operation history

#### Data Protection
- **No Secret Logging**: Passwords never appear in logs
- **Credential Masking**: Usernames shown as `us****er`
- **Secure Storage**: Database credentials encrypted at rest

### Troubleshooting Write Operations

#### Common Issues

**Writes Not Working**
```bash
# Check global enablement
echo $CALDAV_WRITE_ENABLED  # Should be 'true'

# Check source write policy
docker-compose exec skylite-app npx prisma studio
# Look at CalendarSource.writePolicy field

# Check admin token
curl -H "X-Admin-Token: your-token" http://localhost:3000/api/admin/sources
```

**Conflict Errors (409)**
- **Cause**: Event was modified by another client
- **Resolution**: Check conflict details in response
- **Prevention**: Use shorter sync intervals

**Quota Exceeded (429)**
- **Cause**: Too many write operations per minute
- **Resolution**: Wait for quota to refill or reduce write frequency
- **Monitoring**: Check quota status via admin API

**Dry-Run Testing**
```bash
# Enable dry-run mode
CALDAV_DRY_RUN=true

# Test operations - they will be logged but not executed
curl -X POST http://localhost:3000/api/admin/events \
  -H "X-Admin-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "start": "2024-01-01T10:00:00Z", "end": "2024-01-01T11:00:00Z", "sourceId": "your-source"}'

# Check logs for dry-run messages
docker-compose logs skylite-app | grep "DRY RUN"
```

### Backup and Recovery

#### Before Enabling Writes
```bash
# 1. Backup your database
docker-compose exec postgres pg_dump -U skylite skylite > backup.sql

# 2. Test in dry-run mode first
CALDAV_DRY_RUN=true

# 3. Start with a single source
# 4. Monitor audit logs closely
```

#### Recovery Procedures
```bash
# Disable writes globally
CALDAV_WRITE_ENABLED=false
docker-compose restart skylite-app

# Reset source write policy
UPDATE calendar_sources SET writePolicy = 'none' WHERE type = 'caldav';

# Restore from backup if needed
docker-compose exec postgres psql -U skylite skylite < backup.sql
```

### Example Workflows

#### Family Calendar Management
```bash
# 1. Enable writes for family calendar
UPDATE calendar_sources 
SET writePolicy = 'write' 
WHERE name = 'Family Calendar';

# 2. Create family event
curl -X POST http://localhost:3000/api/admin/events \
  -H "X-Admin-Token: family-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Family Dinner",
    "start": "2024-01-15T18:00:00Z",
    "end": "2024-01-15T20:00:00Z",
    "sourceId": "family-calendar-source-id"
  }'

# 3. Event appears on kiosk display
# 4. Family members see it in their CalDAV clients
```

#### Work Calendar Integration
```bash
# 1. Enable writes for work calendar
UPDATE calendar_sources 
SET writePolicy = 'write' 
WHERE name = 'Work Calendar';

# 2. Create meeting
curl -X POST http://localhost:3000/api/admin/events \
  -H "X-Admin-Token: work-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team Meeting",
    "description": "Weekly team sync",
    "location": "Conference Room A",
    "start": "2024-01-16T14:00:00Z",
    "end": "2024-01-16T15:00:00Z",
    "sourceId": "work-calendar-source-id"
  }'

# 3. Meeting appears in Outlook/CalDAV clients
# 4. Kiosk shows updated schedule
```

### Limitations (Phase 3)

- **Experimental**: Use with caution in production
- **No OAuth**: Username/password authentication only
- **Manual Conflict Resolution**: 409 errors require manual intervention
- **No Real-time**: Changes sync on next scheduled sync cycle
- **Limited RRULE**: Basic recurrence rules only
- **Single User**: No multi-user conflict resolution

### Troubleshooting

#### Authentication Issues
```bash
# Check if credentials are correct
curl -u "username:password" "https://your-server.com/remote.php/dav/"

# Verify server URL format
# Nextcloud: https://domain.com/remote.php/dav
# iCloud: https://caldav.icloud.com
# Fastmail: https://caldav.fastmail.com/dav/calendars/user/username/
```

#### Sync Issues
```bash
# Check sync service status
docker-compose logs skylite-app | grep -i caldav

# Verify environment variables
docker-compose exec skylite-app printenv CALDAV_SYNC_ENABLED
```

#### Calendar Not Found
- **Check calendar name** - Use exact calendar name or remove `calendarName` filter
- **Verify permissions** - Ensure user has access to the calendar
- **Check server logs** - Look for permission denied errors

### Example Configurations

#### Family Setup
```bash
# Multiple family members with different colors
CALDAV_ACCOUNTS='[
  {
    "name": "Mom's Calendar",
    "serverUrl": "https://nc.example.com/remote.php/dav",
    "username": "mom@example.com",
    "password": "mom-password",
    "color": "#FF6B6B"
  },
  {
    "name": "Dad's Calendar", 
    "serverUrl": "https://nc.example.com/remote.php/dav",
    "username": "dad@example.com",
    "password": "dad-password",
    "color": "#4ECDC4"
  },
  {
    "name": "Kids Calendar",
    "serverUrl": "https://nc.example.com/remote.php/dav",
    "username": "kids@example.com",
    "password": "kids-password",
    "color": "#45B7D1"
  }
]'
```

#### Work + Personal
```bash
# Separate work and personal calendars
CALDAV_ACCOUNTS='[
  {
    "name": "Work Calendar",
    "serverUrl": "https://caldav.fastmail.com/dav/calendars/user/work/",
    "username": "work@company.com",
    "password": "work-app-password",
    "color": "#E85D04",
    "calendarName": "Work"
  },
  {
    "name": "Personal Calendar",
    "serverUrl": "https://caldav.icloud.com",
    "username": "personal@icloud.com", 
    "password": "personal-app-password",
    "color": "#007AFF"
  }
]'
```

## Persistent Sync State

SkyLite-UX now maintains persistent sync state in the database, ensuring sync metadata survives restarts and enabling efficient incremental synchronization.

### Database Schema

The system uses the following database tables for sync state management:

#### CalendarSource
- **Sync Metadata**: `etag`, `ctag`, `syncToken` for conditional requests
- **Timestamps**: `lastSyncAt`, `lastErrorAt` for tracking sync status
- **Error Tracking**: `errorCount` for monitoring source health
- **Credentials**: Secure storage of CalDAV credentials (server-side only)

#### CalendarEvent
- **Remote Identity**: `uid`, `recurrenceId`, `lastRemoteEtag` for deduplication
- **Versioning**: `version` field for future write operations
- **Unique Constraints**: Prevents duplicate events across sources

#### CalendarAudit & CalendarTombstone
- **Audit Trail**: Complete history of sync operations
- **Tombstones**: Track deleted events for future two-way sync

### Sync State Management

#### Source Bootstrap
Sources are automatically created from environment variables on startup:
```bash
# ICS sources
ICS_FEEDS='[{"name": "Family Calendar", "url": "https://example.com/family.ics", "color": "#FF0000"}]'

# CalDAV sources  
CALDAV_ACCOUNTS='[{"name": "Work Calendar", "serverUrl": "https://caldav.example.com", "username": "user@example.com", "password": "app-password", "color": "#00FF00"}]'
```

#### Incremental Sync
- **Conditional Requests**: Uses stored `etag`/`ctag` to avoid unnecessary downloads
- **304 Responses**: Server returns "Not Modified" when content unchanged
- **Metadata Persistence**: Sync tokens survive restarts, enabling efficient resumption

#### Event Deduplication
- **UID-based**: Primary deduplication using ICS/CalDAV UIDs
- **Synthetic UIDs**: Generated for events without UID using content hash
- **Recurrence Support**: Handles recurring events with `recurrenceId`
- **Source Priority**: Local > CalDAV > ICS for conflict resolution

### Troubleshooting Sync Issues

#### Reset Source Sync State
```bash
# Reset sync metadata for a specific source
docker-compose exec skylite-app npx prisma studio
# Navigate to CalendarSource table and clear etag/ctag/syncToken fields
```

#### Re-bootstrap Sources
```bash
# Restart the application to re-run source bootstrap
docker-compose restart skylite-app
```

#### Rotate CalDAV Credentials
```bash
# Update credentials in environment variables
# Restart application - sources will be updated automatically
docker-compose restart skylite-app
```

#### Monitor Sync Status
```bash
# Check sync status via API
curl http://localhost:3000/api/sync/status

# View sync logs
docker-compose logs skylite-app | grep -i sync
```

### Database Management

#### Run Migrations
```bash
# Apply database migrations
npm run db:migrate

# Reset test database
npm run db:reset:test
```

#### Database Studio
```bash
# Open Prisma Studio for database inspection
npm run db:studio
```

### Future: Phase 3 (Two-Way Sync)

Phase 3 will add full CalDAV support with:
- **Two-way sync** - Create, update, delete events
- **OAuth authentication** - Secure token-based auth
- **Real-time updates** - WebSocket-based synchronization
- **Conflict resolution** - Smart merging of conflicting changes
- **Advanced RRULE** - Full recurrence rule support
- **Per-source write controls** - Granular permission management

## Support

For issues and questions:
- Check the [GitHub Issues](https://github.com/rottenlawns/SkyLite-UX-custom/issues)
- Join the [Discord Community](https://discord.gg/KJn3YfWxn7)
