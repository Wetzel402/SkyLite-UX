import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PersistentCalendarSyncService } from '../../server/services/calendar/persistent-sync';
import { CalendarSourceManager } from '../../server/services/calendar/source-manager';

describe('Persistent Sync Integration', () => {
  let prisma: PrismaClient;
  let syncService: PersistentCalendarSyncService;
  let sourceManager: CalendarSourceManager;

  beforeEach(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'postgresql://user:password@localhost:5432/skylite_test'
        }
      }
    });

    // Clean database
    await prisma.calendarTombstone.deleteMany();
    await prisma.calendarAudit.deleteMany();
    await prisma.calendarEvent.deleteMany();
    await prisma.calendarSource.deleteMany();

    sourceManager = new CalendarSourceManager(prisma);
    syncService = new PersistentCalendarSyncService(prisma);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Full Sync Workflow', () => {
    it('should bootstrap sources and sync events', async () => {
      // Mock environment for bootstrap
      process.env.ICS_FEEDS = JSON.stringify([
        { name: 'Test ICS', url: 'https://example.com/calendar.ics', color: '#FF0000' }
      ]);
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

      // Bootstrap sources
      const bootstrapResult = await sourceManager.bootstrapSources();
      expect(bootstrapResult.created).toBe(2);

      // Get sources
      const sources = await sourceManager.getAllSources();
      expect(sources).toHaveLength(2);

      // Verify sources have correct metadata
      const icsSource = sources.find(s => s.type === 'ics');
      const caldavSource = sources.find(s => s.type === 'caldav');

      expect(icsSource).toBeDefined();
      expect(icsSource?.name).toBe('Test ICS');
      expect(icsSource?.writePolicy).toBe('none');

      expect(caldavSource).toBeDefined();
      expect(caldavSource?.name).toBe('Test CalDAV');
      expect(caldavSource?.writePolicy).toBe('none');
    });

    it('should handle restart scenario with persisted state', async () => {
      // Create a source with existing sync metadata
      const source = await prisma.calendarSource.create({
        data: {
          id: 'test-source',
          type: 'ics',
          name: 'Test Source',
          writePolicy: 'none',
          etag: 'existing-etag',
          lastSyncAt: new Date('2024-01-01T10:00:00Z'),
          errorCount: 0
        }
      });

      // Create some existing events
      await prisma.calendarEvent.create({
        data: {
          sourceId: source.id,
          uid: 'existing-uid',
          title: 'Existing Event',
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z'),
          allDay: false,
          version: 1
        }
      });

      // Simulate restart - get source with existing metadata
      const restartedSource = await sourceManager.getSourceById(source.id);
      expect(restartedSource?.etag).toBe('existing-etag');
      expect(restartedSource?.lastSyncAt).toEqual(new Date('2024-01-01T10:00:00Z'));

      // Verify existing events are still there
      const existingEvents = await syncService.getSourceEvents(source.id);
      expect(existingEvents).toHaveLength(1);
      expect(existingEvents[0].title).toBe('Existing Event');
    });

    it('should create audit logs for sync operations', async () => {
      const source = await prisma.calendarSource.create({
        data: {
          id: 'test-source',
          type: 'ics',
          name: 'Test Source',
          writePolicy: 'none'
        }
      });

      // Simulate sync operation
      await (syncService as any).createAuditLog(source.id, 'sync', 'system', {
        eventsCount: 5,
        newEvents: 3,
        updatedEvents: 2
      });

      // Verify audit log was created
      const auditLogs = await prisma.calendarAudit.findMany({
        where: { sourceId: source.id }
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].op).toBe('sync');
      expect(auditLogs[0].actor).toBe('system');
      expect(auditLogs[0].after).toEqual({
        eventsCount: 5,
        newEvents: 3,
        updatedEvents: 2
      });
    });
  });

  describe('Event Deduplication', () => {
    it('should prevent duplicate events across multiple syncs', async () => {
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
          uid: 'uid-1',
          title: 'Test Event',
          description: 'Test Description',
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z'),
          allDay: false,
          sourceType: 'ics' as const,
          sourceId: source.id,
          sourceName: 'Test Source',
          color: '#FF0000',
          updatedAt: new Date()
        }
      ];

      // First sync
      const result1 = await (syncService as any).storeEvents(source.id, events);
      expect(result1.newEvents).toBe(1);
      expect(result1.updatedEvents).toBe(0);

      // Second sync with same events
      const result2 = await (syncService as any).storeEvents(source.id, events);
      expect(result2.newEvents).toBe(0);
      expect(result2.updatedEvents).toBe(0);

      // Verify only one event exists
      const storedEvents = await prisma.calendarEvent.findMany({
        where: { sourceId: source.id }
      });
      expect(storedEvents).toHaveLength(1);
    });

    it('should handle events with same UID but different recurrence IDs', async () => {
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
          uid: 'uid-1',
          recurrenceId: '2024-01-01T10:00:00Z',
          title: 'Recurring Event - Instance 1',
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z'),
          allDay: false,
          sourceType: 'ics' as const,
          sourceId: source.id,
          sourceName: 'Test Source',
          color: '#FF0000',
          updatedAt: new Date()
        },
        {
          id: 'event-2',
          uid: 'uid-1',
          recurrenceId: '2024-01-08T10:00:00Z',
          title: 'Recurring Event - Instance 2',
          start: new Date('2024-01-08T10:00:00Z'),
          end: new Date('2024-01-08T11:00:00Z'),
          allDay: false,
          sourceType: 'ics' as const,
          sourceId: source.id,
          sourceName: 'Test Source',
          color: '#FF0000',
          updatedAt: new Date()
        }
      ];

      const result = await (syncService as any).storeEvents(source.id, events);
      expect(result.newEvents).toBe(2);
      expect(result.updatedEvents).toBe(0);

      // Verify both events exist
      const storedEvents = await prisma.calendarEvent.findMany({
        where: { sourceId: source.id },
        orderBy: { start: 'asc' }
      });
      expect(storedEvents).toHaveLength(2);
      expect(storedEvents[0].recurrenceId).toBe('2024-01-01T10:00:00Z');
      expect(storedEvents[1].recurrenceId).toBe('2024-01-08T10:00:00Z');
    });
  });
});

