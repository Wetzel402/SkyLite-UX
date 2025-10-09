import { consola } from 'consola';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

interface ICSFeed {
  name: string;
  url: string;
  color?: string;
}

interface CalDAVAccount {
  name: string;
  serverUrl: string;
  username: string;
  password: string;
  color?: string;
}

interface BootstrapResult {
  created: number;
  updated: number;
  skipped: number;
}

export default defineNitroPlugin(async (nitroApp) => {
  // Skip during tests unless explicitly enabled
  if (process.env.NODE_ENV === 'test' && process.env.PERSISTENT_SYNC_TESTS !== 'true') {
    consola.debug('Sources Bootstrap: Skipped during test environment');
    return;
  }

  const prisma = new PrismaClient();
  
  try {
    consola.info('Sources Bootstrap: Starting calendar source bootstrap...');
    
    const result = await bootstrapSources(prisma);
    
    if (result.created === 0 && result.updated === 0 && result.skipped === 0) {
      consola.info('Sources Bootstrap: No sources configured');
    } else {
      consola.success(`Sources Bootstrap: Created ${result.created}, updated ${result.updated}, skipped ${result.skipped}`);
    }
  } catch (error) {
    // Handle database connection errors gracefully
    if (error instanceof Error && error.message.includes('database')) {
      consola.warn('Sources Bootstrap: Database not available, skipping source bootstrap');
      consola.debug('Sources Bootstrap: Database error details:', error.message);
    } else {
      consola.error('Sources Bootstrap: Failed to bootstrap sources:', error);
      // Don't throw - let the server continue starting
    }
  } finally {
    await prisma.$disconnect();
  }
});

async function bootstrapSources(prisma: PrismaClient): Promise<BootstrapResult> {
  const result: BootstrapResult = { created: 0, updated: 0, skipped: 0 };
  
  // Bootstrap ICS feeds
  const icsFeeds = parseICSFeeds();
  for (const feed of icsFeeds) {
    try {
      const sourceId = generateSourceId('ics', feed.url);
      const existing = await prisma.calendarSource.findUnique({ where: { id: sourceId } });
      
      if (existing) {
        // Check if config changed
        const configChanged = 
          existing.name !== feed.name ||
          existing.color !== feed.color ||
          existing.serverUrl !== feed.url;
          
        if (configChanged) {
          await prisma.calendarSource.update({
            where: { id: sourceId },
            data: {
              name: feed.name,
              color: feed.color,
              serverUrl: feed.url,
              updatedAt: new Date()
            }
          });
          result.updated++;
          consola.debug(`Sources Bootstrap: Updated ICS source "${feed.name}"`);
        } else {
          result.skipped++;
        }
      } else {
        await prisma.calendarSource.create({
          data: {
            id: sourceId,
            type: 'ics',
            name: feed.name,
            color: feed.color || '#4C6FFF',
            serverUrl: feed.url,
            writePolicy: 'read-only',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        result.created++;
        consola.debug(`Sources Bootstrap: Created ICS source "${feed.name}"`);
      }
    } catch (error) {
      consola.error(`Sources Bootstrap: Failed to process ICS feed "${feed.name}":`, error);
      // Continue with other feeds
    }
  }
  
  // Bootstrap CalDAV accounts
  const caldavAccounts = parseCalDAVAccounts();
  for (const account of caldavAccounts) {
    try {
      const sourceId = generateSourceId('caldav', account.serverUrl, account.username);
      const existing = await prisma.calendarSource.findUnique({ where: { id: sourceId } });
      
      if (existing) {
        // Check if config changed (excluding password)
        const configChanged = 
          existing.name !== account.name ||
          existing.color !== account.color ||
          existing.serverUrl !== account.serverUrl ||
          existing.username !== account.username;
          
        if (configChanged) {
          await prisma.calendarSource.update({
            where: { id: sourceId },
            data: {
              name: account.name,
              color: account.color,
              serverUrl: account.serverUrl,
              username: account.username,
              // Only update password if it's different (basic check)
              password: account.password !== existing.password ? account.password : existing.password,
              updatedAt: new Date()
            }
          });
          result.updated++;
          consola.debug(`Sources Bootstrap: Updated CalDAV source "${account.name}"`);
        } else {
          result.skipped++;
        }
      } else {
        await prisma.calendarSource.create({
          data: {
            id: sourceId,
            type: 'caldav',
            name: account.name,
            color: account.color || '#4C6FFF',
            serverUrl: account.serverUrl,
            username: account.username,
            password: account.password,
            writePolicy: 'read-write',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        result.created++;
        consola.debug(`Sources Bootstrap: Created CalDAV source "${account.name}"`);
      }
    } catch (error) {
      consola.error(`Sources Bootstrap: Failed to process CalDAV account "${account.name}":`, error);
      // Continue with other accounts
    }
  }
  
  return result;
}

function parseICSFeeds(): ICSFeed[] {
  const feedsEnv = process.env.ICS_FEEDS;
  if (!feedsEnv) return [];
  
  try {
    const feeds = JSON.parse(feedsEnv);
    return Array.isArray(feeds) ? feeds : [];
  } catch (error) {
    consola.warn('Sources Bootstrap: Invalid ICS_FEEDS JSON, skipping');
    return [];
  }
}

function parseCalDAVAccounts(): CalDAVAccount[] {
  const accountsEnv = process.env.CALDAV_ACCOUNTS;
  if (!accountsEnv) return [];
  
  try {
    const accounts = JSON.parse(accountsEnv);
    return Array.isArray(accounts) ? accounts : [];
  } catch (error) {
    consola.warn('Sources Bootstrap: Invalid CALDAV_ACCOUNTS JSON, skipping');
    return [];
  }
}

function generateSourceId(type: string, url: string, username?: string): string {
  const input = `${type}:${url}${username ? `:${username}` : ''}`;
  return createHash('sha256').update(input).digest('hex').substring(0, 16);
}

function maskUsername(username: string): string {
  if (!username) return '';
  if (username.length <= 2) return '*'.repeat(username.length);
  return username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1);
}
