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

### Future: Phase 2 (CalDAV)

Phase 2 will add CalDAV support with:
- **Two-way sync** - Create, update, delete events
- **Authentication** - Username/password or OAuth
- **Real-time updates** - Immediate synchronization
- **Advanced RRULE** - Full recurrence rule support

## Support

For issues and questions:
- Check the [GitHub Issues](https://github.com/rottenlawns/SkyLite-UX-custom/issues)
- Join the [Discord Community](https://discord.gg/KJn3YfWxn7)
