import { vi } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ENABLE_KIOSK_MODE = 'true';
process.env.DISPLAY_TOKEN = 'test-token-123';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.PORT = '3000';

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
