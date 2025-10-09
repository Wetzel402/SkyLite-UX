/**
 * Test Data Utilities
 * Provides deterministic test data for kiosk mode testing
 */

export interface TestUser {
  id: string;
  name: string;
  email: string;
  color: string;
}

export interface TestEvent {
  id: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string;
  location?: string;
  userId: string;
}

export interface TestWeekData {
  startOfWeek: Date;
  endOfWeek: Date;
  weekDates: Date[];
  today: Date;
}

/**
 * Get current week data for testing
 * Ensures consistent week boundaries across test runs
 */
export function getTestWeekData(): TestWeekData {
  const today = new Date();
  const currentDay = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - currentDay);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    weekDates.push(date);
  }

  return {
    startOfWeek,
    endOfWeek,
    weekDates,
    today,
  };
}

/**
 * Get deterministic test users
 */
export function getTestUsers(): TestUser[] {
  return [
    {
      id: 'test-user-1',
      name: 'John Doe',
      email: 'john@example.com',
      color: '#EF4444', // Red
    },
    {
      id: 'test-user-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      color: '#10B981', // Green
    },
    {
      id: 'test-user-3',
      name: 'Family Events',
      email: 'family@example.com',
      color: '#3B82F6', // Blue
    },
  ];
}

/**
 * Get deterministic test events for the current week
 */
export function getTestEvents(): TestEvent[] {
  const weekData = getTestWeekData();
  const users = getTestUsers();

  return [
    {
      id: 'test-event-1',
      title: 'Morning Meeting',
      description: 'Team standup',
      start: new Date(weekData.weekDates[1]), // Monday
      end: new Date(weekData.weekDates[1].getTime() + 2 * 60 * 60 * 1000), // +2 hours
      allDay: false,
      color: '#EF4444',
      location: 'Conference Room A',
      userId: users[0].id,
    },
    {
      id: 'test-event-2',
      title: 'Lunch with Family',
      description: 'Family lunch',
      start: new Date(weekData.weekDates[1].getTime() + 4 * 60 * 60 * 1000), // Monday +4 hours
      end: new Date(weekData.weekDates[1].getTime() + 5 * 60 * 60 * 1000), // +1 hour
      allDay: false,
      color: '#10B981',
      location: 'Home',
      userId: users[1].id,
    },
    {
      id: 'test-event-3',
      title: 'Doctor Appointment',
      description: 'Annual checkup',
      start: new Date(weekData.weekDates[2]), // Tuesday
      end: new Date(weekData.weekDates[2].getTime() + 1 * 60 * 60 * 1000), // +1 hour
      allDay: false,
      color: '#3B82F6',
      location: 'Medical Center',
      userId: users[2].id,
    },
    {
      id: 'test-event-4',
      title: 'Weekend Trip',
      description: 'Family vacation',
      start: new Date(weekData.weekDates[5]), // Saturday
      end: new Date(weekData.weekDates[6]), // Sunday
      allDay: true,
      color: '#8B5CF6',
      location: 'Beach House',
      userId: users[2].id,
    },
    {
      id: 'test-event-5',
      title: 'Today\'s Event',
      description: 'Event happening today',
      start: new Date(weekData.today.getTime() + 2 * 60 * 60 * 1000), // Today +2 hours
      end: new Date(weekData.today.getTime() + 3 * 60 * 60 * 1000), // Today +3 hours
      allDay: false,
      color: '#F59E0B',
      location: 'Office',
      userId: users[0].id,
    },
  ];
}

/**
 * Get mock API response for /api/events/week
 */
export function getMockEventsResponse() {
  const events = getTestEvents();
  const weekData = getTestWeekData();

  return {
    events: events.map(event => ({
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      allDay: event.allDay,
      color: event.color,
      location: event.location,
      users: [{
        id: event.userId,
        name: getTestUsers().find(u => u.id === event.userId)?.name || 'Unknown',
        color: event.color,
      }],
    })),
    weekStart: weekData.startOfWeek.toISOString(),
    weekEnd: weekData.endOfWeek.toISOString(),
    totalEvents: events.length,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get test environment variables
 */
export function getTestEnv() {
  return {
    NODE_ENV: 'test',
    ENABLE_KIOSK_MODE: 'true',
    DISPLAY_TOKEN: 'test-token-123',
    DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/skylite_test',
    NUXT_PUBLIC_LOG_LEVEL: 'error',
  };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(condition: () => boolean, timeout = 5000, interval = 100): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Format date for display in tests
 */
export function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format time for display in tests
 */
export function formatTimeForDisplay(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
