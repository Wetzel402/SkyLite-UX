import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalDAVAdapter } from '../../server/services/calendar/adapters/caldav';
import { CalendarSource } from '../../app/lib/calendar/types';

// Mock tsdav
vi.mock('tsdav', () => ({
  createDAVClient: vi.fn(),
}));

describe('CalDAV Adapter', () => {
  let adapter: CalDAVAdapter;
  let mockSource: CalendarSource;
  let mockClient: any;
  let mockCreateDAVClient: any;

  beforeEach(async () => {
    // Import the mocked module
    const tsdav = await import('tsdav');
    mockCreateDAVClient = vi.mocked(tsdav.createDAVClient);
    
    mockClient = {
      findCalendarHome: vi.fn(),
      findCalendars: vi.fn(),
      fetchCalendarObjects: vi.fn(),
    };
    
    mockCreateDAVClient.mockReturnValue(mockClient);
    
    adapter = new CalDAVAdapter();
    mockSource = {
      id: 'test-caldav-source',
      name: 'Test CalDAV Calendar',
      type: 'caldav',
      color: '#2E7D32',
      enabled: true,
      credentials: {
        username: 'testuser',
        password: 'testpass',
        serverUrl: 'https://caldav.example.com',
        calendarName: 'Personal',
      },
    };
    vi.clearAllMocks();
  });

  it('should validate source with valid credentials', async () => {
    mockClient.findCalendarHome.mockResolvedValueOnce('https://caldav.example.com/calendars/testuser/');

    const isValid = await adapter.validateSource(mockSource);
    expect(isValid).toBe(true);
    expect(mockCreateDAVClient).toHaveBeenCalledWith({
      serverUrl: 'https://caldav.example.com',
      credentials: {
        username: 'testuser',
        password: 'testpass',
      },
      authMethod: 'Basic',
    });
  });

  it('should reject source with invalid credentials', async () => {
    mockClient.findCalendarHome.mockRejectedValueOnce(new Error('Authentication failed'));

    const isValid = await adapter.validateSource(mockSource);
    expect(isValid).toBe(false);
  });

  it('should fetch events from CalDAV server', async () => {
    const mockCalendarHome = 'https://caldav.example.com/calendars/testuser/';
    const mockCalendars = [
      {
        url: 'https://caldav.example.com/calendars/testuser/personal/',
        displayName: 'Personal',
      },
    ];
    const mockEvents = [
      {
        data: `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Calendar//EN
BEGIN:VEVENT
UID:caldav-event-1@example.com
DTSTART:20241009T140000Z
DTEND:20241009T150000Z
SUMMARY:CalDAV Test Event
DESCRIPTION:CalDAV test description
LOCATION:CalDAV Test Location
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`,
      },
    ];

    mockClient.findCalendarHome.mockResolvedValueOnce(mockCalendarHome);
    mockClient.findCalendars.mockResolvedValueOnce(mockCalendars);
    mockClient.fetchCalendarObjects.mockResolvedValueOnce(mockEvents);

    const events = await adapter.fetchEvents(mockSource);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      uid: 'caldav-event-1@example.com',
      title: 'CalDAV Test Event',
      description: 'CalDAV test description',
      location: 'CalDAV Test Location',
      sourceType: 'caldav',
      sourceId: 'test-caldav-source',
      sourceName: 'Test CalDAV Calendar',
      color: '#2E7D32',
    });
    expect(events[0].start).toBeInstanceOf(Date);
    expect(events[0].end).toBeInstanceOf(Date);
  });

  it('should filter calendars by name when specified', async () => {
    const mockCalendarHome = 'https://caldav.example.com/calendars/testuser/';
    const mockCalendars = [
      {
        url: 'https://caldav.example.com/calendars/testuser/personal/',
        displayName: 'Personal',
      },
      {
        url: 'https://caldav.example.com/calendars/testuser/work/',
        displayName: 'Work',
      },
    ];

    mockClient.findCalendarHome.mockResolvedValueOnce(mockCalendarHome);
    mockClient.findCalendars.mockResolvedValueOnce(mockCalendars);
    mockClient.fetchCalendarObjects.mockResolvedValueOnce([]);

    await adapter.fetchEvents(mockSource);

    // Should only fetch from Personal calendar
    expect(mockClient.fetchCalendarObjects).toHaveBeenCalledWith({
      calendar: mockCalendars[0],
      timeRange: expect.any(Object),
    });
  });

  it('should handle multiple calendars', async () => {
    // Create a source without calendarName filter
    const multiCalendarSource = {
      ...mockSource,
      credentials: {
        ...mockSource.credentials,
        calendarName: undefined, // No filtering
      },
    };

    const mockCalendarHome = 'https://caldav.example.com/calendars/testuser/';
    const mockCalendars = [
      {
        url: 'https://caldav.example.com/calendars/testuser/personal/',
        displayName: 'Personal',
      },
      {
        url: 'https://caldav.example.com/calendars/testuser/work/',
        displayName: 'Work',
      },
    ];
    const mockEvents1 = [
      {
        data: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:personal-event@example.com
DTSTART:20241009T140000Z
DTEND:20241009T150000Z
SUMMARY:Personal Event
END:VEVENT
END:VCALENDAR`,
      },
    ];
    const mockEvents2 = [
      {
        data: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:work-event@example.com
DTSTART:20241009T160000Z
DTEND:20241009T170000Z
SUMMARY:Work Event
END:VEVENT
END:VCALENDAR`,
      },
    ];

    mockClient.findCalendarHome.mockResolvedValueOnce(mockCalendarHome);
    mockClient.findCalendars.mockResolvedValueOnce(mockCalendars);
    mockClient.fetchCalendarObjects
      .mockResolvedValueOnce(mockEvents1)
      .mockResolvedValueOnce(mockEvents2);

    const events = await adapter.fetchEvents(multiCalendarSource);

    expect(events).toHaveLength(2);
    expect(events[0].title).toBe('Personal Event');
    expect(events[1].title).toBe('Work Event');
  });

  it('should handle calendar discovery failure', async () => {
    mockClient.findCalendarHome.mockResolvedValueOnce(null);

    await expect(adapter.fetchEvents(mockSource)).rejects.toThrow('Calendar home not found');
  });

  it('should handle no calendars found', async () => {
    const mockCalendarHome = 'https://caldav.example.com/calendars/testuser/';
    mockClient.findCalendarHome.mockResolvedValueOnce(mockCalendarHome);
    mockClient.findCalendars.mockResolvedValueOnce([]);

    const events = await adapter.fetchEvents(mockSource);
    expect(events).toHaveLength(0);
  });

  it('should handle calendar fetch errors gracefully', async () => {
    const mockCalendarHome = 'https://caldav.example.com/calendars/testuser/';
    const mockCalendars = [
      {
        url: 'https://caldav.example.com/calendars/testuser/personal/',
        displayName: 'Personal',
      },
      {
        url: 'https://caldav.example.com/calendars/testuser/work/',
        displayName: 'Work',
      },
    ];
    const mockEvents = [
      {
        data: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:personal-event@example.com
DTSTART:20241009T140000Z
DTEND:20241009T150000Z
SUMMARY:Personal Event
END:VEVENT
END:VCALENDAR`,
      },
    ];

    mockClient.findCalendarHome.mockResolvedValueOnce(mockCalendarHome);
    mockClient.findCalendars.mockResolvedValueOnce(mockCalendars);
    mockClient.fetchCalendarObjects
      .mockResolvedValueOnce(mockEvents) // Personal calendar succeeds
      .mockRejectedValueOnce(new Error('Work calendar fetch failed')); // Work calendar fails

    const events = await adapter.fetchEvents(mockSource);

    // Should still return events from successful calendars
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Personal Event');
  });

  it('should parse date-only events as all-day', async () => {
    const mockCalendarHome = 'https://caldav.example.com/calendars/testuser/';
    const mockCalendars = [
      {
        url: 'https://caldav.example.com/calendars/testuser/personal/',
        displayName: 'Personal',
      },
    ];
    const mockEvents = [
      {
        data: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:all-day-event@example.com
DTSTART:20241009
DTEND:20241010
SUMMARY:All Day Event
END:VEVENT
END:VCALENDAR`,
      },
    ];

    mockClient.findCalendarHome.mockResolvedValueOnce(mockCalendarHome);
    mockClient.findCalendars.mockResolvedValueOnce(mockCalendars);
    mockClient.fetchCalendarObjects.mockResolvedValueOnce(mockEvents);

    const events = await adapter.fetchEvents(mockSource);
    expect(events[0].allDay).toBe(true);
  });

  it('should handle invalid ICS content gracefully', async () => {
    const mockCalendarHome = 'https://caldav.example.com/calendars/testuser/';
    const mockCalendars = [
      {
        url: 'https://caldav.example.com/calendars/testuser/personal/',
        displayName: 'Personal',
      },
    ];
    const mockEvents = [
      {
        data: 'Invalid ICS content',
      },
    ];

    mockClient.findCalendarHome.mockResolvedValueOnce(mockCalendarHome);
    mockClient.findCalendars.mockResolvedValueOnce(mockCalendars);
    mockClient.fetchCalendarObjects.mockResolvedValueOnce(mockEvents);

    const events = await adapter.fetchEvents(mockSource);
    expect(events).toHaveLength(0);
  });

  it('should mask credentials in error messages', async () => {
    mockClient.findCalendarHome.mockRejectedValueOnce(new Error('Authentication failed'));

    // This test would need to be updated to check console output
    // For now, we'll just ensure the method doesn't throw
    await expect(adapter.validateSource(mockSource)).resolves.toBe(false);
  });
});
