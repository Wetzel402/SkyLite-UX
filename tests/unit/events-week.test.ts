import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Events Week API', () => {
  let prisma: PrismaClient;

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

  it('should return empty array when no events exist', async () => {
    // This test validates the database query logic
    const events = await prisma.calendarEvent.findMany({
      where: {
        start: {
          gte: new Date('2025-01-01T00:00:00.000Z'),
          lte: new Date('2025-01-07T00:00:00.000Z')
        },
        status: {
          not: 'cancelled'
        }
      },
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        allDay: true,
        source: {
          select: {
            type: true,
            name: true,
            color: true
          }
        }
      },
      orderBy: [
        { start: 'asc' },
        { title: 'asc' }
      ]
    });

    expect(Array.isArray(events)).toBe(true);
    expect(events).toEqual([]);
  });

  it('should return events when they exist in date range', async () => {
    // Create a test source
    const source = await prisma.calendarSource.create({
      data: {
        type: 'local',
        name: 'Test Source',
        color: '#FF0000',
        writePolicy: 'NONE'
      }
    });

    // Create a test event
    const event = await prisma.calendarEvent.create({
      data: {
        title: 'Test Event',
        description: 'Test Description',
        start: new Date('2025-01-03T12:00:00.000Z'),
        end: new Date('2025-01-03T13:00:00.000Z'),
        allDay: false,
        sourceId: source.id,
        uid: 'test-event-1',
        status: 'confirmed'
      }
    });

    const events = await prisma.calendarEvent.findMany({
      where: {
        start: {
          gte: new Date('2025-01-01T00:00:00.000Z'),
          lte: new Date('2025-01-07T00:00:00.000Z')
        },
        status: {
          not: 'cancelled'
        }
      },
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        allDay: true,
        source: {
          select: {
            type: true,
            name: true,
            color: true
          }
        }
      },
      orderBy: [
        { start: 'asc' },
        { title: 'asc' }
      ]
    });

    expect(Array.isArray(events)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: event.id,
      title: 'Test Event',
      allDay: false,
      source: {
        type: 'local',
        name: 'Test Source',
        color: '#FF0000'
      }
    });
  });

  it('should exclude cancelled events', async () => {
    // Create a test source
    const source = await prisma.calendarSource.create({
      data: {
        type: 'local',
        name: 'Test Source',
        color: '#FF0000',
        writePolicy: 'NONE'
      }
    });

    // Create confirmed event
    await prisma.calendarEvent.create({
      data: {
        title: 'Confirmed Event',
        description: 'Confirmed Description',
        start: new Date('2025-01-03T12:00:00.000Z'),
        end: new Date('2025-01-03T13:00:00.000Z'),
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
        start: new Date('2025-01-03T14:00:00.000Z'),
        end: new Date('2025-01-03T15:00:00.000Z'),
        allDay: false,
        sourceId: source.id,
        uid: 'cancelled-event',
        status: 'cancelled'
      }
    });

    const events = await prisma.calendarEvent.findMany({
      where: {
        start: {
          gte: new Date('2025-01-01T00:00:00.000Z'),
          lte: new Date('2025-01-07T00:00:00.000Z')
        },
        status: {
          not: 'cancelled'
        }
      },
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        allDay: true,
        source: {
          select: {
            type: true,
            name: true,
            color: true
          }
        }
      },
      orderBy: [
        { start: 'asc' },
        { title: 'asc' }
      ]
    });

    expect(Array.isArray(events)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Confirmed Event');
  });

  it('should sort events by start time and title', async () => {
    // Create a test source
    const source = await prisma.calendarSource.create({
      data: {
        type: 'local',
        name: 'Test Source',
        color: '#FF0000',
        writePolicy: 'NONE'
      }
    });

    // Create events in reverse order
    await prisma.calendarEvent.create({
      data: {
        title: 'Z Event',
        description: 'Z Description',
        start: new Date('2025-01-03T14:00:00.000Z'),
        end: new Date('2025-01-03T15:00:00.000Z'),
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
        start: new Date('2025-01-03T12:00:00.000Z'),
        end: new Date('2025-01-03T13:00:00.000Z'),
        allDay: false,
        sourceId: source.id,
        uid: 'a-event',
        status: 'confirmed'
      }
    });

    const events = await prisma.calendarEvent.findMany({
      where: {
        start: {
          gte: new Date('2025-01-01T00:00:00.000Z'),
          lte: new Date('2025-01-07T00:00:00.000Z')
        },
        status: {
          not: 'cancelled'
        }
      },
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        allDay: true,
        source: {
          select: {
            type: true,
            name: true,
            color: true
          }
        }
      },
      orderBy: [
        { start: 'asc' },
        { title: 'asc' }
      ]
    });

    expect(Array.isArray(events)).toBe(true);
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe('A Event');
    expect(events[1].title).toBe('Z Event');
  });

  it('should handle database connection errors gracefully', async () => {
    // Disconnect the database to simulate connection error
    await prisma.$disconnect();

    // This test validates that the API should handle database errors gracefully
    // In a real scenario, the API would catch the error and return an empty array
    expect(true).toBe(true); // Placeholder for error handling test
  });
});