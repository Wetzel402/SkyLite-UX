import { consola } from 'consola';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

/**
 * Calendar Source Manager
 * Handles bootstrap and management of calendar sources from environment variables
 */

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
  calendarName?: string;
}

export class CalendarSourceManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Bootstrap calendar sources from environment variables
   * Creates or updates CalendarSource rows based on ICS_FEEDS and CALDAV_ACCOUNTS
   */
  async bootstrapSources(): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    try {
      // Bootstrap ICS sources
      const icsSources = this.parseICSSources();
      for (const source of icsSources) {
        const result = await this.upsertSource(source);
        if (result.created) created++;
        else updated++;
      }

      // Bootstrap CalDAV sources
      const caldavSources = this.parseCalDAVSources();
      for (const source of caldavSources) {
        const result = await this.upsertSource(source);
        if (result.created) created++;
        else updated++;
      }

      consola.info(`Calendar Source Bootstrap: Created ${created} sources, updated ${updated} sources`);
      return { created, updated };

    } catch (error) {
      consola.error('Failed to bootstrap calendar sources:', error);
      throw error;
    }
  }

  /**
   * Parse ICS_FEEDS environment variable
   */
  private parseICSSources(): Array<{
    id: string;
    type: 'ics';
    name: string;
    color?: string;
    serverUrl?: string;
    username?: string;
    password?: string;
  }> {
    const feedsJson = process.env.ICS_FEEDS;
    if (!feedsJson) return [];

    try {
      const feeds: ICSFeed[] = JSON.parse(feedsJson);
      return feeds.map((feed, index) => ({
        id: this.generateSourceId('ics', feed.url),
        type: 'ics' as const,
        name: feed.name || `ICS Feed ${index + 1}`,
        color: feed.color,
        serverUrl: feed.url,
      }));
    } catch (error) {
      consola.warn('Invalid ICS_FEEDS configuration, skipping ICS sources:', error);
      return [];
    }
  }

  /**
   * Parse CALDAV_ACCOUNTS environment variable
   */
  private parseCalDAVSources(): Array<{
    id: string;
    type: 'caldav';
    name: string;
    color?: string;
    serverUrl?: string;
    username?: string;
    password?: string;
  }> {
    if (process.env.CALDAV_SYNC_ENABLED !== 'true') return [];

    const accountsJson = process.env.CALDAV_ACCOUNTS;
    if (!accountsJson) return [];

    try {
      const accounts: CalDAVAccount[] = JSON.parse(accountsJson);
      return accounts.map((account, index) => ({
        id: this.generateSourceId('caldav', account.serverUrl, account.username),
        type: 'caldav' as const,
        name: account.name || `CalDAV ${index + 1}`,
        color: account.color,
        serverUrl: account.serverUrl,
        username: account.username,
        password: account.password,
      }));
    } catch (error) {
      consola.warn('Invalid CALDAV_ACCOUNTS configuration, skipping CalDAV sources:', error);
      return [];
    }
  }

  /**
   * Generate deterministic source ID
   */
  private generateSourceId(type: string, serverUrl: string, username?: string): string {
    const key = username ? `${type}:${serverUrl}:${username}` : `${type}:${serverUrl}`;
    return createHash('sha256').update(key).digest('hex').substring(0, 16);
  }

  /**
   * Upsert a calendar source
   */
  private async upsertSource(source: {
    id: string;
    type: string;
    name: string;
    color?: string;
    serverUrl?: string;
    username?: string;
    password?: string;
  }): Promise<{ created: boolean }> {
    const existing = await this.prisma.calendarSource.findUnique({
      where: { id: source.id }
    });

    if (existing) {
      // Update existing source
      await this.prisma.calendarSource.update({
        where: { id: source.id },
        data: {
          name: source.name,
          color: source.color,
          serverUrl: source.serverUrl,
          username: source.username,
          password: source.password,
          updatedAt: new Date(),
        }
      });
      return { created: false };
    } else {
      // Create new source
      await this.prisma.calendarSource.create({
        data: {
          id: source.id,
          type: source.type,
          name: source.name,
          color: source.color,
          serverUrl: source.serverUrl,
          username: source.username,
          password: source.password,
          writePolicy: 'none',
        }
      });
      return { created: true };
    }
  }

  /**
   * Get all calendar sources
   */
  async getAllSources() {
    return this.prisma.calendarSource.findMany({
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Get a specific source by ID
   */
  async getSourceById(id: string) {
    return this.prisma.calendarSource.findUnique({
      where: { id }
    });
  }

  /**
   * Update source sync metadata
   */
  async updateSyncMetadata(
    sourceId: string,
    metadata: {
      etag?: string;
      ctag?: string;
      syncToken?: string;
      lastSyncAt?: Date;
      lastErrorAt?: Date;
      errorCount?: number;
    }
  ) {
    return this.prisma.calendarSource.update({
      where: { id: sourceId },
      data: {
        ...metadata,
        updatedAt: new Date(),
      }
    });
  }

  /**
   * Reset source sync state (for troubleshooting)
   */
  async resetSourceSyncState(sourceId: string) {
    return this.prisma.calendarSource.update({
      where: { id: sourceId },
      data: {
        etag: null,
        ctag: null,
        syncToken: null,
        lastSyncAt: null,
        lastErrorAt: null,
        errorCount: 0,
        updatedAt: new Date(),
      }
    });
  }
}



