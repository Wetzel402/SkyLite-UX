import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PersistentCalendarSyncService } from '../../server/services/calendar/persistent-sync';
import { CalendarSourceManager } from '../../server/services/calendar/source-manager';

describe('Persistent Sync Service', () => {
  let prisma: PrismaClient;
  let syncService: PersistentCalendarSyncService;
  let sourceManager: CalendarSourceManager;
  let databaseAvailable = false;

  beforeEach(async () => {
    // Use test database
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/skylite_test'
        }
      }
    });

    try {
      // Test database connection
      await prisma.$connect();
      databaseAvailable = true;
      
      // Clean database
      await prisma.calendarTombstone.deleteMany();
      await prisma.calendarAudit.deleteMany();
      await prisma.calendarEvent.deleteMany();
      await prisma.calendarSource.deleteMany();

      sourceManager = new CalendarSourceManager(prisma);
      syncService = new PersistentCalendarSyncService(prisma);
    } catch (error) {
      // Skip tests if database is not available
      console.warn('Database not available for persistent sync tests, skipping...');
      databaseAvailable = false;
      return;
    }
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Source Bootstrap', () => {
    it('should create ICS sources from environment', async () => {
    if (!databaseAvailable) {
      console.log('Skipping test - database not available');
      return;
    }
      // Mock environment variables
      process.env.ICS_FEEDS = JSON.stringify([
        { name: 'Test ICS', url: 'https://example.com/calendar.ics', color: '#FF0000' }
      ]);

      const result = await sourceManager.bootstrapSources();
      
      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);

      const sources = await sourceManager.getAllSources();
      expect(sources).toHaveLength(1);
      expect(sources[0].type).toBe('ics');
      expect(sources[0].name).toBe('Test ICS');
      expect(sources[0].serverUrl).toBe('https://example.com/calendar.ics');
    });

    it('should create CalDAV sources from environment', async () => {
      if (!databaseAvailable) {
        console.log('Skipping test - database not available');
        return;
      }
      // Mock environment variables
      process.env.CALDAV_SYNC_ENABLED = 'true';
      process.env.CALDAV_ACCOUNTS = JSON.stringify([
        { 
          name: 'Test CalDAV', 
          serverUrl: 'https://caldav.example.com', 
          username: 'test@example.com',
          password: 'testpass',
          color: '#00FF00'
        }
      ]);

      const result = await sourceManager.bootstrapSources();
      
      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);

      const sources = await sourceManager.getAllSources();
      expect(sources).toHaveLength(1);
      expect(sources[0].type).toBe('caldav');
      expect(sources[0].name).toBe('Test CalDAV');
      expect(sources[0].serverUrl).toBe('https://caldav.example.com');
      expect(sources[0].username).toBe('test@example.com');
    });

    it('should generate stable source IDs', async () => {
      if (!databaseAvailable) {
        console.log('Skipping test - database not available');
        return;
      }
      process.env.ICS_FEEDS = JSON.stringify([
        { name: 'Test ICS', url: 'https://example.com/calendar.ics' }
      ]);

      // Bootstrap twice
      await sourceManager.bootstrapSources();
      const result = await sourceManager.bootstrapSources();
      
      // Second bootstrap should update, not create
      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);
    });
  });

  describe('Event Storage', () => {
    it('should store events with deduplication', async () => {
      if (!databaseAvailable) {
        console.log('Skipping test - database not available');
        return;
      }
      // Create a test source
      const source = await prisma.calendarSource.create({
        data: {
          id: 'test-source',
          type: 'ics',
          name: 'Test Source',
          writePolicy: 'none'
        }
      });

      // Mock events
      const events = [
        {
          id: 'event-1',
          uid: 'uid-1',
          title: 'Test Event 1',
          description: 'Test Description',
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z'),
          allDay: false,
          location: 'Test Location',
          sourceType: 'ics' as const,
          sourceId: source.id,
          sourceName: 'Test Source',
          color: '#FF0000',
          updatedAt: new Date()
        }
      ];

      // Store events
      const result = await (syncService as any).storeEvents(source.id, events);
      
      expect(result.newEvents).toBe(1);
      expect(result.updatedEvents).toBe(0);

      // Verify event was stored
      const storedEvents = await prisma.calendarEvent.findMany({
        where: { sourceId: source.id }
      });
      
      expect(storedEvents).toHaveLength(1);
      expect(storedEvents[0].title).toBe('Test Event 1');
      expect(storedEvents[0].uid).toBe('uid-1');
    });

    it('should handle events without UID by generating synthetic UID', async () => {
      if (!databaseAvailable) {
        console.log('Skipping test - database not available');
        return;
      }
      const source = await prisma.calendarSource.create({
        data: {
          id: 'test-source',
          type: 'ics',
          name: 'Test Source',
          writePolicy: 'none'
        }
      });

      const events = [
        {
          id: 'event-1',
          uid: undefined, // No UID
          title: 'Test Event 1',
          description: 'Test Description',
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z'),
          allDay: false,
          location: 'Test Location',
          sourceType: 'ics' as const,
          sourceId: source.id,
          sourceName: 'Test Source',
          color: '#FF0000',
          updatedAt: new Date()
        }
      ];

      await (syncService as any).storeEvents(source.id, events);

      const storedEvents = await prisma.calendarEvent.findMany({
        where: { sourceId: source.id }
      });
      
      expect(storedEvents).toHaveLength(1);
      expect(storedEvents[0].uid).toBeDefined();
      expect(storedEvents[0].uid).toMatch(/^[a-f0-9]{40}$/); // SHA1 hash
    });

    it('should update existing events when content changes', async () => {
      if (!databaseAvailable) {
        console.log('Skipping test - database not available');
        return;
      }
      const source = await prisma.calendarSource.create({
        data: {
          id: 'test-source',
          type: 'ics',
          name: 'Test Source',
          writePolicy: 'none'
        }
      });

      // Create initial event
      const initialEvent = await prisma.calendarEvent.create({
        data: {
          sourceId: source.id,
          uid: 'uid-1',
          title: 'Original Title',
          description: 'Original Description',
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z'),
          allDay: false,
          version: 1
        }
      });

      // Update event with same UID but different content
      const updatedEvents = [
        {
          id: 'event-1',
          uid: 'uid-1',
          title: 'Updated Title',
          description: 'Updated Description',
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z'),
          allDay: false,
          location: 'Updated Location',
          sourceType: 'ics' as const,
          sourceId: source.id,
          sourceName: 'Test Source',
          color: '#FF0000',
          updatedAt: new Date()
        }
      ];

      const result = await (syncService as any).storeEvents(source.id, updatedEvents);
      
      expect(result.newEvents).toBe(0);
      expect(result.updatedEvents).toBe(1);

      // Verify event was updated
      const updatedEvent = await prisma.calendarEvent.findUnique({
        where: { id: initialEvent.id }
      });
      
      expect(updatedEvent?.title).toBe('Updated Title');
      expect(updatedEvent?.description).toBe('Updated Description');
      expect(updatedEvent?.version).toBe(2);
    });
  });

  describe('Sync Metadata', () => {
    it('should update sync metadata after successful sync', async () => {
      if (!databaseAvailable) {
        console.log('Skipping test - database not available');
        return;
      }
      const source = await prisma.calendarSource.create({
        data: {
          id: 'test-source',
          type: 'ics',
          name: 'Test Source',
          writePolicy: 'none'
        }
      });

      // Update sync metadata
      await sourceManager.updateSyncMetadata(source.id, {
        lastSyncAt: new Date('2024-01-01T12:00:00Z'),
        etag: 'test-etag',
        errorCount: 0
      });

      const updatedSource = await prisma.calendarSource.findUnique({
        where: { id: source.id }
      });

      expect(updatedSource?.lastSyncAt).toEqual(new Date('2024-01-01T12:00:00Z'));
      expect(updatedSource?.etag).toBe('test-etag');
      expect(updatedSource?.errorCount).toBe(0);
    });

    it('should increment error count on sync failure', async () => {
      if (!databaseAvailable) {
        console.log('Skipping test - database not available');
        return;
      }
      const source = await prisma.calendarSource.create({
        data: {
          id: 'test-source',
          type: 'ics',
          name: 'Test Source',
          writePolicy: 'none',
          errorCount: 0
        }
      });

      // Simulate error
      await sourceManager.updateSyncMetadata(source.id, {
        lastErrorAt: new Date(),
        errorCount: 1
      });

      const updatedSource = await prisma.calendarSource.findUnique({
        where: { id: source.id }
      });

      expect(updatedSource?.errorCount).toBe(1);
      expect(updatedSource?.lastErrorAt).toBeDefined();
    });
  });
});

