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
