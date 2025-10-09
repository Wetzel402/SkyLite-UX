import { FullConfig } from '@playwright/test';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

async function globalSetup(playwrightConfig: FullConfig) {
  // Load test environment variables
  const envTestPath = join(process.cwd(), '.env.test');
  
  if (existsSync(envTestPath)) {
    console.log('Loading test environment from .env.test');
    config({ path: envTestPath });
  } else {
    console.log('No .env.test found, using default test environment');
  }

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.ENABLE_KIOSK_MODE = 'true';
  process.env.DISPLAY_TOKEN = 'test-token';
  process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/skylite_test';
  process.env.NUXT_PUBLIC_LOG_LEVEL = 'error';
  process.env.NUXT_PUBLIC_TZ = 'UTC';
  process.env.TZ = 'UTC';
  process.env.PORT = '3000';

  console.log('Test environment configured:');
  console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`- ENABLE_KIOSK_MODE: ${process.env.ENABLE_KIOSK_MODE}`);
  console.log(`- DISPLAY_TOKEN: ${process.env.DISPLAY_TOKEN ? 'set' : 'not set'}`);
  console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'not set'}`);
}

export default globalSetup;
