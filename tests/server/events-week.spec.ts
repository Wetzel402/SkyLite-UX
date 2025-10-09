import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { setup, $fetch } from '@nuxt/test-utils';

describe('Events Week API', () => {
  let prisma: PrismaClient;
  const testToken = 'test-token';

  beforeEach(async () => {
    // Setup test database
    prisma = new PrismaClient();
    
    // Clean up any existing test data
    await prisma.calendarEvent.deleteMany();
    await prisma.calendarSource.deleteMany();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.calendarEvent.deleteMany();
    await prisma.calendarSource.deleteMany();
    await prisma.$disconnect();
  });

  it('returns 200 and empty array when no events exist', async () => {
    const response = await $fetch('/api/events/week', {
      query: { token: testToken }
    });

    expect(response).toEqual([]);
    expect(Array.isArray(response)).toBe(true);
  });

  it('returns 401 when no token provided', async () => {
    try {
      await $fetch('/api/events/week');
      expect.fail('Should have thrown 401 error');
    } catch (error: any) {
      expect(error.statusCode).toBe(401);
      expect(error.statusMessage).toContain('Display token required');
    }
  });

  it('returns 401 when invalid token provided', async () => {
    try {
      await $fetch('/api/events/week', {
        query: { token: 'invalid-token' }
      });
      expect.fail('Should have thrown 401 error');
    } catch (error: any) {
      expect(error.statusCode).toBe(401);
      expect(error.statusMessage).toContain('Invalid display token');
    }
  });

  it('returns array with one event when event exists in date range', async () => {
    // Create a test source
    const source = await prisma.calendarSource.create({
      data: {
        type: 'local',
        name: 'Test Source',
        color: '#FF0000',
        writePolicy: 'NONE'
      }
    });

    // Create a test event for current week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const event = await prisma.calendarEvent.create({
      data: {
        title: 'Test Event',
        description: 'Test Description',
        start: startOfWeek,
        end: new Date(startOfWeek.getTime() + 60 * 60 * 1000), // 1 hour later
        allDay: false,
        sourceId: source.id,
        uid: 'test-event-1',
        status: 'confirmed'
      }
    });

    const response = await $fetch('/api/events/week', {
      query: { token: testToken }
    });

    expect(Array.isArray(response)).toBe(true);
    expect(response).toHaveLength(1);
    expect(response[0]).toMatchObject({
      id: event.id,
      title: 'Test Event',
      allDay: false,
      source: {
        type: 'local',
        name: 'Test Source',
        color: '#FF0000'
      }
    });
    expect(response[0].start).toBe(startOfWeek.toISOString());
    expect(response[0].end).toBe(new Date(startOfWeek.getTime() + 60 * 60 * 1000).toISOString());
  });

  it('returns empty array when from > to', async () => {
    const response = await $fetch('/api/events/week', {
      query: { 
        token: testToken,
        from: '2025-12-31T00:00:00.000Z',
        to: '2025-01-01T00:00:00.000Z'
      }
    });

    expect(response).toEqual([]);
    expect(Array.isArray(response)).toBe(true);
  });

  it('returns events within custom date range', async () => {
    // Create a test source
    const source = await prisma.calendarSource.create({
      data: {
        type: 'local',
        name: 'Test Source',
        color: '#FF0000',
        writePolicy: 'NONE'
      }
    });

    // Create events inside and outside the range
    const rangeStart = new Date('2025-01-01T00:00:00.000Z');
    const rangeEnd = new Date('2025-01-07T00:00:00.000Z');

    // Event inside range
    const insideEvent = await prisma.calendarEvent.create({
      data: {
        title: 'Inside Event',
        description: 'Inside Description',
        start: new Date('2025-01-03T12:00:00.000Z'),
        end: new Date('2025-01-03T13:00:00.000Z'),
        allDay: false,
        sourceId: source.id,
        uid: 'inside-event',
        status: 'confirmed'
      }
    });

    // Event outside range
    await prisma.calendarEvent.create({
      data: {
        title: 'Outside Event',
        description: 'Outside Description',
        start: new Date('2025-02-01T12:00:00.000Z'),
        end: new Date('2025-02-01T13:00:00.000Z'),
        allDay: false,
        sourceId: source.id,
        uid: 'outside-event',
        status: 'confirmed'
      }
    });

    const response = await $fetch('/api/events/week', {
      query: { 
        token: testToken,
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString()
      }
    });

    expect(Array.isArray(response)).toBe(true);
    expect(response).toHaveLength(1);
    expect(response[0].title).toBe('Inside Event');
  });

  it('returns empty array when no events in date range', async () => {
    const response = await $fetch('/api/events/week', {
      query: { 
        token: testToken,
        from: '2025-01-01T00:00:00.000Z',
        to: '2025-01-07T00:00:00.000Z'
      }
    });

    expect(response).toEqual([]);
    expect(Array.isArray(response)).toBe(true);
  });

  it('handles database errors gracefully', async () => {
    // Mock a database error by disconnecting
    await prisma.$disconnect();

    const response = await $fetch('/api/events/week', {
      query: { token: testToken }
    });

    // Should still return 200 with empty array
    expect(response).toEqual([]);
    expect(Array.isArray(response)).toBe(true);
  });

  it('excludes cancelled events', async () => {
    // Create a test source
    const source = await prisma.calendarSource.create({
      data: {
        type: 'local',
        name: 'Test Source',
        color: '#FF0000',
        writePolicy: 'NONE'
      }
    });

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Create confirmed event
    await prisma.calendarEvent.create({
      data: {
        title: 'Confirmed Event',
        description: 'Confirmed Description',
        start: startOfWeek,
        end: new Date(startOfWeek.getTime() + 60 * 60 * 1000),
        allDay: false,
        sourceId: source.id,
        uid: 'confirmed-event',
        status: 'confirmed'
      }
    });

    // Create cancelled event
    await prisma.calendarEvent.create({
      data: {
        title: 'Cancelled Event',
        description: 'Cancelled Description',
        start: startOfWeek,
        end: new Date(startOfWeek.getTime() + 60 * 60 * 1000),
        allDay: false,
        sourceId: source.id,
        uid: 'cancelled-event',
        status: 'cancelled'
      }
    });

    const response = await $fetch('/api/events/week', {
      query: { token: testToken }
    });

    expect(Array.isArray(response)).toBe(true);
    expect(response).toHaveLength(1);
    expect(response[0].title).toBe('Confirmed Event');
  });

  it('includes proper cache headers', async () => {
    const response = await $fetch('/api/events/week', {
      query: { token: testToken },
      response: true
    });

    expect(response.headers['cache-control']).toBe('public, max-age=15');
    expect(response.headers['content-type']).toBe('application/json');
  });

  it('sorts events by start time and title', async () => {
    // Create a test source
    const source = await prisma.calendarSource.create({
      data: {
        type: 'local',
        name: 'Test Source',
        color: '#FF0000',
        writePolicy: 'NONE'
      }
    });

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Create events in reverse order
    await prisma.calendarEvent.create({
      data: {
        title: 'Z Event',
        description: 'Z Description',
        start: new Date(startOfWeek.getTime() + 2 * 60 * 60 * 1000), // 2 hours later
        end: new Date(startOfWeek.getTime() + 3 * 60 * 60 * 1000),
        allDay: false,
        sourceId: source.id,
        uid: 'z-event',
        status: 'confirmed'
      }
    });

    await prisma.calendarEvent.create({
      data: {
        title: 'A Event',
        description: 'A Description',
        start: new Date(startOfWeek.getTime() + 1 * 60 * 60 * 1000), // 1 hour later
        end: new Date(startOfWeek.getTime() + 2 * 60 * 60 * 1000),
        allDay: false,
        sourceId: source.id,
        uid: 'a-event',
        status: 'confirmed'
      }
    });

    const response = await $fetch('/api/events/week', {
      query: { token: testToken }
    });

    expect(Array.isArray(response)).toBe(true);
    expect(response).toHaveLength(2);
    expect(response[0].title).toBe('A Event');
    expect(response[1].title).toBe('Z Event');
  });
});
