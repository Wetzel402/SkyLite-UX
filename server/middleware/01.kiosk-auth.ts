import { consola } from "consola";
import { createError, defineEventHandler, getHeader, getQuery } from "h3";

// Kiosk mode authentication middleware
// Validates display token and enforces read-only access

export default defineEventHandler(async (event) => {
  const url = event.node.req.url || '';
  
  // Only apply to kiosk routes
  if (!url.startsWith('/display') && !url.startsWith('/api/events/week')) {
    return;
  }

  // Check if kiosk mode is enabled
  const isKioskEnabled = process.env.ENABLE_KIOSK_MODE === 'true';
  
  if (!isKioskEnabled) {
    consola.warn(`Kiosk Auth: Kiosk mode disabled, rejecting access to ${url}`);
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found'
    });
  }

  // Check for display token if configured
  const displayToken = process.env.DISPLAY_TOKEN;
  
  if (displayToken) {
    // Get token from query param or header
    const queryToken = getQuery(event).token as string;
    const headerToken = getHeader(event, 'x-display-token');
    const providedToken = queryToken || headerToken;

    if (!providedToken) {
      consola.warn(`Kiosk Auth: No display token provided for ${url}`);
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized - Display token required'
      });
    }

    if (providedToken !== displayToken) {
      consola.warn(`Kiosk Auth: Invalid display token for ${url}`);
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden - Invalid display token'
      });
    }

    consola.debug(`Kiosk Auth: Valid display token provided for ${url}`);
  }

  // Enforce read-only access for kiosk endpoints
  if (event.node.req.method && !['GET', 'HEAD', 'OPTIONS'].includes(event.node.req.method)) {
    consola.warn(`Kiosk Auth: Write method ${event.node.req.method} blocked on kiosk endpoint ${url}`);
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed - Kiosk endpoints are read-only'
    });
  }

  // Add kiosk context to event
  event.context.kioskMode = true;
  event.context.displayToken = displayToken;
});
