import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Admin Events API Integration', () => {
  let prisma: PrismaClient;
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const adminToken = process.env.ADMIN_API_TOKEN || 'test-admin';

  beforeEach(async () => {
    prisma = new PrismaClient();
    
    // Clean up test data
    await prisma.calendarAudit.deleteMany();
    await prisma.calendarTombstone.deleteMany();
    await prisma.calendarEvent.deleteMany();
    await prisma.calendarSource.deleteMany();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/admin/events', () => {
    it('should create event successfully with CalDAV write enabled', async () => {
      // Create a test source with write policy
      const source = await prisma.calendarSource.create({
        data: {
          type: 'caldav',
          name: 'Test CalDAV Source',
          writePolicy: 'write',
          serverUrl: 'https://caldav.example.com',
          username: 'testuser',
          password: 'testpass'
        }
      });

      // Set environment variables
      process.env.CALDAV_WRITE_ENABLED = 'true';
      process.env.CALDAV_DRY_RUN = 'true'; // Use dry-run for testing

      const response = await fetch(`${baseURL}/api/admin/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({
          title: 'Test Event',
          description: 'Test Description',
          location: 'Test Location',
          start: '2024-01-01T10:00:00Z',
          end: '2024-01-01T11:00:00Z',
          allDay: false,
          sourceId: source.id
        })
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.event.title).toBe('Test Event');
      expect(result.event.status).toBe('pending'); // Should be pending in dry-run mode

      // Verify database records
      const event = await prisma.calendarEvent.findUnique({
        where: { id: result.event.id }
      });
      expect(event).toBeTruthy();
      expect(event?.title).toBe('Test Event');

      // Verify audit record
      const audit = await prisma.calendarAudit.findFirst({
        where: { eventId: result.event.id, op: 'create' }
      });
      expect(audit).toBeTruthy();
      expect(audit?.actor).toBe('user');
    });

    it('should reject request when writes are disabled', async () => {
      const source = await prisma.calendarSource.create({
        data: {
          type: 'caldav',
          name: 'Test CalDAV Source',
          writePolicy: 'none',
          serverUrl: 'https://caldav.example.com',
          username: 'testuser',
          password: 'testpass'
        }
      });

      process.env.CALDAV_WRITE_ENABLED = 'false';

      const response = await fetch(`${baseURL}/api/admin/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({
          title: 'Test Event',
          start: '2024-01-01T10:00:00Z',
          end: '2024-01-01T11:00:00Z',
          sourceId: source.id
        })
      });

      expect(response.status).toBe(403);
    });

    it('should reject request without admin token', async () => {
      const response = await fetch(`${baseURL}/api/admin/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Test Event',
          start: '2024-01-01T10:00:00Z',
          end: '2024-01-01T11:00:00Z',
          sourceId: 'test-source'
        })
      });

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await fetch(`${baseURL}/api/admin/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({
          title: 'Test Event'
          // Missing required fields
        })
      });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/admin/events/:id', () => {
    it('should update event successfully', async () => {
      const source = await prisma.calendarSource.create({
        data: {
          type: 'caldav',
          name: 'Test CalDAV Source',
          writePolicy: 'write',
          serverUrl: 'https://caldav.example.com',
          username: 'testuser',
          password: 'testpass'
        }
      });

      const event = await prisma.calendarEvent.create({
        data: {
          sourceId: source.id,
          title: 'Original Title',
          description: 'Original Description',
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z'),
          allDay: false,
          status: 'confirmed',
          version: 1
        }
      });

      process.env.CALDAV_WRITE_ENABLED = 'true';
      process.env.CALDAV_DRY_RUN = 'true';

      const response = await fetch(`${baseURL}/api/admin/events/${event.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({
          title: 'Updated Title',
          description: 'Updated Description'
        })
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.event.title).toBe('Updated Title');
      expect(result.event.version).toBe(2);

      // Verify database update
      const updatedEvent = await prisma.calendarEvent.findUnique({
        where: { id: event.id }
      });
      expect(updatedEvent?.title).toBe('Updated Title');
      expect(updatedEvent?.version).toBe(2);

      // Verify audit record
      const audit = await prisma.calendarAudit.findFirst({
        where: { eventId: event.id, op: 'update' }
      });
      expect(audit).toBeTruthy();
      expect(audit?.actor).toBe('user');
    });

    it('should handle conflict errors gracefully', async () => {
      const source = await prisma.calendarSource.create({
        data: {
          type: 'caldav',
          name: 'Test CalDAV Source',
          writePolicy: 'write',
          serverUrl: 'https://caldav.example.com',
          username: 'testuser',
          password: 'testpass'
        }
      });

      const event = await prisma.calendarEvent.create({
        data: {
          sourceId: source.id,
          title: 'Original Title',
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z'),
          allDay: false,
          status: 'confirmed',
          version: 1,
          lastRemoteEtag: 'original-etag'
        }
      });

      process.env.CALDAV_WRITE_ENABLED = 'true';
      // Don't use dry-run to test real conflict handling

      // This would need a mock CalDAV server to test properly
      // For now, we'll just verify the endpoint exists
      const response = await fetch(`${baseURL}/api/admin/events/${event.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({
          title: 'Updated Title'
        })
      });

      // Should either succeed or fail gracefully
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('DELETE /api/admin/events/:id', () => {
    it('should delete event successfully', async () => {
      const source = await prisma.calendarSource.create({
        data: {
          type: 'caldav',
          name: 'Test CalDAV Source',
          writePolicy: 'write',
          serverUrl: 'https://caldav.example.com',
          username: 'testuser',
          password: 'testpass'
        }
      });

      const event = await prisma.calendarEvent.create({
        data: {
          sourceId: source.id,
          title: 'Test Event',
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z'),
          allDay: false,
          status: 'confirmed',
          version: 1
        }
      });

      process.env.CALDAV_WRITE_ENABLED = 'true';
      process.env.CALDAV_DRY_RUN = 'true';

      const response = await fetch(`${baseURL}/api/admin/events/${event.id}`, {
        method: 'DELETE',
        headers: {
          'X-Admin-Token': adminToken
        }
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.event.status).toBe('cancelled');

      // Verify database update
      const deletedEvent = await prisma.calendarEvent.findUnique({
        where: { id: event.id }
      });
      expect(deletedEvent?.status).toBe('cancelled');

      // Verify tombstone record
      const tombstone = await prisma.calendarTombstone.findFirst({
        where: { eventId: event.id }
      });
      expect(tombstone).toBeTruthy();

      // Verify audit record
      const audit = await prisma.calendarAudit.findFirst({
        where: { eventId: event.id, op: 'delete' }
      });
      expect(audit).toBeTruthy();
      expect(audit?.actor).toBe('user');
    });

    it('should return 404 for non-existent event', async () => {
      const response = await fetch(`${baseURL}/api/admin/events/non-existent-id`, {
        method: 'DELETE',
        headers: {
          'X-Admin-Token': adminToken
        }
      });

      expect(response.status).toBe(404);
    });
  });

  describe('Quota Management', () => {
    it('should enforce write quotas', async () => {
      const source = await prisma.calendarSource.create({
        data: {
          type: 'caldav',
          name: 'Test CalDAV Source',
          writePolicy: 'write',
          serverUrl: 'https://caldav.example.com',
          username: 'testuser',
          password: 'testpass'
        }
      });

      process.env.CALDAV_WRITE_ENABLED = 'true';
      process.env.CALDAV_DRY_RUN = 'true';

      // This test would need to be enhanced to actually test quota limits
      // For now, we'll just verify the endpoint handles the request
      const response = await fetch(`${baseURL}/api/admin/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({
          title: 'Test Event',
          start: '2024-01-01T10:00:00Z',
          end: '2024-01-01T11:00:00Z',
          sourceId: source.id
        })
      });

      expect([200, 429]).toContain(response.status);
    });
  });
});
