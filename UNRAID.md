# SkyLite-UX on Unraid

This guide explains how to deploy SkyLite-UX on Unraid using Docker Compose.

## Prerequisites

- Unraid 6.8+ with Docker support
- Community Applications plugin installed
- At least 2GB RAM available
- PostgreSQL database (can be containerized or external)

## Quick Setup

### Option 1: Using Community Applications (Recommended)

1. **Install from Community Applications**
   - Go to Apps → Community Applications
   - Search for "SkyLite-UX"
   - Click Install

2. **Configure the application**
   - Set your database credentials
   - Configure calendar sources
   - Enable kiosk mode if desired

### Option 2: Manual Docker Compose Setup

1. **Create application directory**
   ```bash
   mkdir -p /mnt/user/appdata/skylite-ux
   cd /mnt/user/appdata/skylite-ux
   ```

2. **Download configuration files**
   ```bash
   # Download docker-compose.yml
   curl -o docker-compose.yml https://raw.githubusercontent.com/rottenlawns/SkyLite-UX-custom/main/docker-compose.yml
   
   # Download .env.example
   curl -o .env.example https://raw.githubusercontent.com/rottenlawns/SkyLite-UX-custom/main/.env.example
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start the application**
   ```bash
   docker-compose up -d
   ```

## Configuration

### Environment Variables

Create a `.env` file in your application directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://skylite:your_password@postgres:5432/skylite
POSTGRES_PASSWORD=your_secure_password

# Application Settings
NODE_ENV=production
NUXT_PUBLIC_LOG_LEVEL=info
NUXT_PUBLIC_TZ=America/Chicago

# Kiosk Mode (Optional)
ENABLE_KIOSK_MODE=true
DISPLAY_TOKEN=your_display_token

# CalDAV Write Operations (Optional - Experimental)
CALDAV_WRITE_ENABLED=false
CALDAV_DRY_RUN=true
ADMIN_API_TOKEN=your_admin_token

# Calendar Sources
ICS_FEEDS='[{"name": "Google Calendar", "url": "https://calendar.google.com/calendar/ical/your-email%40gmail.com/private-xxx/basic.ics", "color": "#4285F4"}]'
CALDAV_ACCOUNTS='[{"name": "Nextcloud", "serverUrl": "https://your-nextcloud.com/remote.php/dav", "username": "your-username", "password": "your-password", "color": "#0082C9"}]'
```

### Port Configuration

- **Application**: Port 3000 (default)
- **PostgreSQL**: Port 5432 (internal only)
- **Kiosk Display**: Access via `http://your-unraid-ip:3000/display?token=your_display_token`

## Unraid-Specific Considerations

### Container Management

**Important**: Unraid doesn't handle CLI-based container modifications well. Always use the Unraid web interface or Docker Compose for management.

### Storage

- **App Data**: `/mnt/user/appdata/skylite-ux/`
- **Database**: Stored in Docker volume `postgres_data`
- **Backups**: Include both application data and database volumes

### Network Configuration

- **Bridge Mode**: Default (recommended)
- **Host Mode**: Only if you need direct port access
- **Custom Networks**: Use Docker Compose networks for isolation

### Performance Optimization

1. **Memory Allocation**
   - Minimum: 1GB for application
   - Recommended: 2GB+ for production
   - PostgreSQL: 512MB minimum

2. **CPU Allocation**
   - Minimum: 1 CPU core
   - Recommended: 2+ cores for better performance

3. **Storage**
   - Use SSD for better database performance
   - Consider separate cache drive for PostgreSQL

## Maintenance

### Updates

1. **Stop the application**
   ```bash
   docker-compose down
   ```

2. **Pull latest images**
   ```bash
   docker-compose pull
   ```

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

### Backups

1. **Database backup**
   ```bash
   docker-compose exec postgres pg_dump -U skylite skylite > backup.sql
   ```

2. **Application data backup**
   ```bash
   # Backup configuration
   cp .env .env.backup
   
   # Backup volumes (if needed)
   docker run --rm -v skylite-ux_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .
   ```

### Logs

```bash
# View application logs
docker-compose logs -f skylite-app

# View database logs
docker-compose logs -f postgres

# View all logs
docker-compose logs -f
```

## Troubleshooting

### Common Issues

1. **Container won't start**
   - Check logs: `docker-compose logs skylite-app`
   - Verify database connection
   - Check port conflicts

2. **Database connection errors**
   - Ensure PostgreSQL is running: `docker-compose ps`
   - Check DATABASE_URL in .env
   - Verify credentials

3. **Kiosk mode not working**
   - Verify ENABLE_KIOSK_MODE=true
   - Check DISPLAY_TOKEN is set
   - Test with: `curl "http://localhost:3000/display?token=your_token"`

4. **Calendar sync issues**
   - Check ICS_FEEDS and CALDAV_ACCOUNTS configuration
   - Verify external calendar URLs are accessible
   - Check logs for sync errors

### Health Checks

```bash
# Application health
curl http://localhost:3000/api/health

# Database health
docker-compose exec postgres pg_isready -U skylite

# Events API (kiosk mode)
curl "http://localhost:3000/api/events/week?token=your_display_token"
```

### Performance Monitoring

```bash
# Container resource usage
docker stats

# Database performance
docker-compose exec postgres psql -U skylite -d skylite -c "SELECT * FROM pg_stat_activity;"
```

## Security Considerations

1. **Change default passwords**
   - Update POSTGRES_PASSWORD
   - Set strong DISPLAY_TOKEN
   - Use secure ADMIN_API_TOKEN

2. **Network security**
   - Use reverse proxy (Nginx Proxy Manager)
   - Enable SSL/TLS certificates
   - Restrict access to admin endpoints

3. **Data protection**
   - Regular backups
   - Encrypt sensitive data
   - Monitor access logs

## Advanced Configuration

### Reverse Proxy Setup

Use Nginx Proxy Manager or similar:

```nginx
# Nginx configuration
location / {
    proxy_pass http://skylite-app:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### SSL/TLS Configuration

1. **Obtain certificates** (Let's Encrypt recommended)
2. **Configure reverse proxy** with SSL
3. **Update application URLs** in configuration

### High Availability

For production deployments:

1. **Database clustering** (PostgreSQL streaming replication)
2. **Load balancing** (multiple application instances)
3. **Health monitoring** (external health checks)
4. **Automated failover** (container orchestration)

## Support

- **Documentation**: [SkyLite-UX Docs](https://wetzel402.github.io/Skylite-UX-docs/)
- **Issues**: [GitHub Issues](https://github.com/rottenlawns/SkyLite-UX-custom/issues)
- **Discord**: [SkyLite-UX Discord](https://discord.gg/KJn3YfWxn7)

## Changelog

- **v2025.10.0**: Initial Unraid support
- **v2025.10.1**: Added kiosk mode support
- **v2025.10.2**: Enhanced Docker Compose configuration
- **v2025.10.3**: Added CalDAV write operations (experimental)
