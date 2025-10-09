import { consola } from "consola";
import { defineEventHandler, setHeader } from "h3";

// Security headers middleware for kiosk mode
// Applies strict security headers to kiosk pages and API

export default defineEventHandler(async (event) => {
  const url = event.node.req.url || '';
  
  // Only apply to kiosk routes
  if (!url.startsWith('/display') && !url.startsWith('/api/events/week')) {
    return;
  }

  // Check if this is a kiosk request
  if (!event.context.kioskMode) {
    return;
  }

  consola.debug(`Kiosk Security: Applying security headers to ${url}`);

  // Content Security Policy - Strict for kiosk mode
  setHeader(event, 'Content-Security-Policy', 
    "default-src 'self'; " +
    "img-src 'self' data:; " +
    "style-src 'self' 'unsafe-inline'; " +
    "script-src 'self'; " +
    "connect-src 'self'; " +
    "font-src 'self'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'none'; " +
    "frame-ancestors 'none'"
  );

  // Prevent embedding in frames
  setHeader(event, 'X-Frame-Options', 'DENY');

  // Control referrer information
  setHeader(event, 'Referrer-Policy', 'no-referrer');

  // Restrict permissions
  setHeader(event, 'Permissions-Policy', 
    'geolocation=(), camera=(), microphone=(), payment=(), usb=(), ' +
    'magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=()'
  );

  // Additional security headers
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'X-XSS-Protection', '1; mode=block');
  setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Prevent caching of sensitive data
  if (url.startsWith('/api/')) {
    setHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    setHeader(event, 'Pragma', 'no-cache');
    setHeader(event, 'Expires', '0');
  }

  consola.debug(`Kiosk Security: Security headers applied to ${url}`);
});
