import { vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ENABLE_KIOSK_MODE = 'true';
process.env.DISPLAY_TOKEN = 'test-token';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/skylite_test';
process.env.PORT = '3000';
process.env.CALENDAR_SYNC_ENABLED = 'true';
process.env.ICS_FEEDS = '[{"name":"Fixture","color":"#4C6FFF","url":"http://localhost:3000/_fixtures/family.ics"}]';
process.env.ADMIN_API_TOKEN = 'test-admin';
process.env.PERSISTENT_SYNC_TESTS = 'true';

// Mock consola to reduce noise in tests
vi.mock('consola', () => ({
  consola: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }
}));

// Mock Prisma client
vi.mock('../../app/lib/prisma', () => ({
  default: {
    calendarEvent: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    calendarEventUser: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  }
}));

// Mock h3 functions
vi.mock('h3', () => ({
  createEvent: vi.fn(() => ({
    node: {
      req: { url: '/api/events/week', method: 'GET' },
      res: { setHeader: vi.fn() }
    }
  })),
  getQuery: vi.fn(() => ({})),
  getHeader: vi.fn(() => undefined),
  setHeader: vi.fn(),
  createError: vi.fn((options) => {
    const error = new Error(options.message || 'Test error');
    (error as any).statusCode = options.statusCode || 500;
    return error;
  }),
  defineEventHandler: vi.fn((handler) => handler),
}));
