import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { consola } from 'consola';

async function waitForDatabase(maxRetries = 30, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL
          }
        }
      });
      
      await prisma.$connect();
      await prisma.$disconnect();
      consola.success('Global Test Setup: Database connection successful');
      return true;
    } catch (error) {
      if (i === maxRetries - 1) {
        consola.error('Global Test Setup: Database connection failed after maximum retries');
        throw new Error('Database not available for tests');
      }
      consola.debug(`Global Test Setup: Database not ready, retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

export default async function globalSetup() {
  consola.info('Global Test Setup: Starting...');
  
  try {
    // Check if we're in a test environment that needs database setup
    if (process.env.PERSISTENT_SYNC_TESTS === 'true') {
      consola.info('Global Test Setup: Setting up test database...');
      
      // Wait for database to be available
      await waitForDatabase();
      
      // Run database migrations
      try {
        execSync('npx prisma migrate deploy', { 
          stdio: 'pipe',
          env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
        });
        consola.success('Global Test Setup: Database migrations completed');
      } catch (error) {
        consola.warn('Global Test Setup: Database migration failed, continuing with tests');
      }
      
      // Seed test database with a sample ICS source
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL
          }
        }
      });
      
      try {
        // Check if sources already exist
        const existingSources = await prisma.calendarSource.count();
        
        if (existingSources === 0) {
          // Create a test ICS source
          await prisma.calendarSource.create({
            data: {
              id: 'test-ics-source-001',
              type: 'ics',
              name: 'Fixture',
              color: '#4C6FFF',
              serverUrl: 'http://localhost:3000/_fixtures/family.ics',
              writePolicy: 'read-only',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          consola.success('Global Test Setup: Created test ICS source');
        } else {
          consola.info(`Global Test Setup: Found ${existingSources} existing sources, skipping seed`);
        }
      } catch (error) {
        consola.warn('Global Test Setup: Failed to seed database:', error);
      } finally {
        await prisma.$disconnect();
      }
    } else {
      consola.info('Global Test Setup: Skipping database setup (PERSISTENT_SYNC_TESTS not enabled)');
    }
    
    consola.success('Global Test Setup: Completed successfully');
  } catch (error) {
    consola.error('Global Test Setup: Failed:', error);
    // Don't throw - let tests run with mocked database
    consola.warn('Global Test Setup: Continuing with tests (database may be mocked)');
  }
}