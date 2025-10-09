import { z } from 'zod';
import { consola } from 'consola';

// Environment validation schema for SkyLite-UX
const envSchema = z.object({
  // Database configuration
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // Kiosk mode configuration
  ENABLE_KIOSK_MODE: z.enum(['true', 'false']).transform(val => val === 'true'),
  DISPLAY_TOKEN: z.string().min(8, 'DISPLAY_TOKEN must be at least 8 characters').optional(),
  
  // Application configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.string().regex(/^\d+$/, 'PORT must be a number').transform(Number).default(3000),
  
  // Optional integrations
  NUXT_PUBLIC_LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  NUXT_PUBLIC_TZ: z.string().optional(),
  
  // Calendar sync configuration
  CALENDAR_SYNC_ENABLED: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  CALDAV_SYNC_ENABLED: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  ICS_SYNC_INTERVAL_SECONDS: z.string().regex(/^\d+$/).transform(Number).optional(),
  CALDAV_SYNC_INTERVAL_SECONDS: z.string().regex(/^\d+$/).transform(Number).optional(),
  CALDAV_ACCOUNTS: z.string().optional(),
  ICS_FEEDS: z.string().optional(),
  
  // CalDAV write configuration (Phase 3 - Experimental)
  CALDAV_WRITE_ENABLED: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  CALDAV_DRY_RUN: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  CALDAV_WRITE_DEFAULT_POLICY: z.enum(['none', 'write']).default('none'),
  ADMIN_API_TOKEN: z.string().min(8, 'ADMIN_API_TOKEN must be at least 8 characters').optional(),
});

// Validate environment variables
export function validateEnvironment() {
  try {
    const env = envSchema.parse(process.env);
    
    // Log kiosk configuration (without secrets)
    consola.info('Environment validation:');
    consola.info(`  - Kiosk mode: ${env.ENABLE_KIOSK_MODE ? 'ENABLED' : 'DISABLED'}`);
    consola.info(`  - Display token: ${env.DISPLAY_TOKEN ? 'CONFIGURED' : 'NOT SET'}`);
    consola.info(`  - Database: ${env.DATABASE_URL ? 'CONFIGURED' : 'NOT SET'}`);
    consola.info(`  - Port: ${env.PORT}`);
    consola.info(`  - Environment: ${env.NODE_ENV}`);
    consola.info(`  - Calendar sync: ${env.CALENDAR_SYNC_ENABLED ? 'ENABLED' : 'DISABLED'}`);
    consola.info(`  - CalDAV sync: ${env.CALDAV_SYNC_ENABLED ? 'ENABLED' : 'DISABLED'}`);
    consola.info(`  - ICS sync interval: ${env.ICS_SYNC_INTERVAL_SECONDS || 'default'}s`);
    consola.info(`  - CalDAV sync interval: ${env.CALDAV_SYNC_INTERVAL_SECONDS || 'default'}s`);
    consola.info(`  - CalDAV write: ${env.CALDAV_WRITE_ENABLED ? 'ENABLED' : 'DISABLED'}`);
    consola.info(`  - CalDAV dry-run: ${env.CALDAV_DRY_RUN ? 'ENABLED' : 'DISABLED'}`);
    consola.info(`  - CalDAV write policy: ${env.CALDAV_WRITE_DEFAULT_POLICY}`);
    consola.info(`  - Admin API: ${env.ADMIN_API_TOKEN ? 'CONFIGURED' : 'NOT SET'}`);
    
    if (env.ENABLE_KIOSK_MODE && !env.DISPLAY_TOKEN) {
      consola.warn('Kiosk mode is enabled but no DISPLAY_TOKEN is set - kiosk will be publicly accessible');
    }
    
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      consola.error('Environment validation failed:');
      error.errors.forEach(err => {
        consola.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

// Export validated environment
export const env = validateEnvironment();
export type Env = z.infer<typeof envSchema>;
