# Security Policy

## Kiosk Mode Security

SkyLite-UX includes a **Kiosk Mode** designed for wall displays and public terminals. This mode has specific security considerations and access controls.

### Access Control

#### Display Token Authentication
- **Optional but recommended**: Set `DISPLAY_TOKEN` environment variable
- **Token validation**: Required for `/display` and `/api/events/week` endpoints
- **Token sources**: Query parameter `?token=XYZ` or header `X-Display-Token`
- **Security**: Use a strong, random token (minimum 8 characters)

#### Feature Flag
- **Environment control**: `ENABLE_KIOSK_MODE=true/false`
- **Disabled state**: Returns 404 for all kiosk endpoints
- **No bundle exposure**: Kiosk routes not accessible when disabled

### Read-Only Access

#### API Restrictions
- **Method blocking**: Only GET, HEAD, OPTIONS allowed on kiosk endpoints
- **Write prevention**: All POST, PUT, DELETE, PATCH methods blocked
- **Data filtering**: Only event title, time, color, and location exposed
- **No PII**: User emails, IDs, and sensitive data excluded

#### Service Worker Security
- **Scope limitation**: Only caches kiosk-specific assets
- **Endpoint blocking**: Never caches authentication or write endpoints
- **Pattern matching**: Blocks sensitive API patterns
- **Cache isolation**: Separate cache namespace for kiosk mode

### Security Headers

#### Content Security Policy
```
default-src 'self';
img-src 'self' data:;
style-src 'self' 'unsafe-inline';
script-src 'self';
connect-src 'self';
```

#### Additional Headers
- **X-Frame-Options**: DENY (prevents embedding)
- **Referrer-Policy**: no-referrer (no referrer information)
- **Permissions-Policy**: Restricts camera, microphone, geolocation
- **X-Content-Type-Options**: nosniff (prevents MIME sniffing)

### Rate Limiting

#### Token Bucket Algorithm
- **Rate limit**: 60 requests per minute per IP/token
- **Memory-based**: In-memory with LRU cleanup
- **Automatic cleanup**: Removes old entries every 5 minutes
- **Graceful degradation**: Returns 429 when limit exceeded

### Data Privacy

#### Exposed Data
- **Event title**: Public event names only
- **Time information**: Start/end times
- **Color coding**: User-assigned colors
- **Location**: Public event locations

#### Excluded Data
- **User details**: Names, emails, IDs
- **Event descriptions**: Private event details
- **Integration data**: API keys, tokens
- **User preferences**: Personal settings

### Network Security

#### HTTPS Requirements
- **Production**: Always use HTTPS in production
- **Certificate validation**: Valid SSL certificates required
- **HSTS headers**: Strict Transport Security enabled
- **Proxy configuration**: Use reverse proxy for SSL termination

#### Firewall Rules
- **Port restrictions**: Only expose necessary ports
- **IP whitelisting**: Restrict access to trusted networks
- **VPN access**: Use VPN for remote kiosk management

### Deployment Security

#### Environment Variables
```bash
# Required for kiosk mode
ENABLE_KIOSK_MODE=true
DISPLAY_TOKEN=your-secure-token-here

# Database security
DATABASE_URL=postgresql://user:pass@host:5432/db

# Optional security
NUXT_PUBLIC_LOG_LEVEL=info
```

#### Docker Security
- **Non-root user**: Application runs as non-root
- **Read-only filesystem**: Where possible
- **Resource limits**: CPU and memory constraints
- **Network isolation**: Custom Docker network

### Monitoring and Logging

#### Security Events
- **Failed authentication**: Invalid token attempts
- **Rate limit exceeded**: Too many requests
- **Method violations**: Write attempts on read-only endpoints
- **Access attempts**: When kiosk mode disabled

#### Log Levels
- **Debug**: Token validation, cache hits
- **Info**: Successful authentications, rate limits
- **Warn**: Invalid tokens, rate limit exceeded
- **Error**: Database errors, system failures

### Best Practices

#### Token Management
1. **Generate strong tokens**: Use cryptographically secure random strings
2. **Rotate regularly**: Change tokens periodically
3. **Secure storage**: Store tokens securely, not in code
4. **Monitor usage**: Log token access for security auditing

#### Network Configuration
1. **Use reverse proxy**: NGINX, Traefik, or Cloudflare
2. **Enable SSL**: Always use HTTPS in production
3. **Restrict access**: Firewall rules for kiosk endpoints
4. **Monitor traffic**: Log and monitor network access

#### Deployment
1. **Environment validation**: Validate all environment variables
2. **Health checks**: Monitor application health
3. **Backup strategy**: Regular database backups
4. **Update strategy**: Security updates and patches

### Incident Response

#### Security Breach
1. **Immediate**: Disable kiosk mode (`ENABLE_KIOSK_MODE=false`)
2. **Investigate**: Check logs for unauthorized access
3. **Rotate tokens**: Generate new display tokens
4. **Update**: Apply security patches if available

#### Monitoring
- **Access logs**: Monitor all kiosk endpoint access
- **Error rates**: Watch for unusual error patterns
- **Performance**: Monitor response times and resource usage
- **Uptime**: Ensure kiosk displays remain functional

### Contact

For security issues or questions:
- **GitHub Issues**: [Create a security issue](https://github.com/rottenlawns/SkyLite-UX-custom/issues)
- **Discord**: [Join our community](https://discord.gg/KJn3YfWxn7)
- **Email**: Security concerns can be reported privately

## Reporting Security Issues

If you discover a security vulnerability:
1. **Do not** create a public issue
2. **Contact** the maintainers privately
3. **Provide** detailed information about the issue
4. **Allow** time for the issue to be addressed
5. **Follow** responsible disclosure practices
