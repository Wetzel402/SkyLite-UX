import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ICSAdapter } from '../../server/services/calendar/adapters/ics';
import { CalendarSource } from '../../app/lib/calendar/types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ICS Adapter', () => {
  let adapter: ICSAdapter;
  let mockSource: CalendarSource;

  beforeEach(() => {
    adapter = new ICSAdapter();
    mockSource = {
      id: 'test-source',
      name: 'Test Calendar',
      type: 'ics',
      color: '#4C6FFF',
      url: 'https://example.com/test.ics',
      enabled: true,
    };
    vi.clearAllMocks();
  });

  it('should validate source with valid URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (name: string) => name === 'content-type' ? 'text/calendar' : null,
      },
    });

    const isValid = await adapter.validateSource(mockSource);
    expect(isValid).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(mockSource.url, expect.any(Object));
  });

  it('should reject source with invalid URL', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const isValid = await adapter.validateSource(mockSource);
    expect(isValid).toBe(false);
  });

  it('should parse ICS content correctly', async () => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Calendar//EN
BEGIN:VEVENT
UID:test-event-1@example.com
DTSTART:20241009T140000Z
DTEND:20241009T150000Z
SUMMARY:Test Event
DESCRIPTION:Test description
LOCATION:Test Location
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(icsContent),
    });

    const events = await adapter.fetchEvents(mockSource);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      uid: 'test-event-1@example.com',
      title: 'Test Event',
      description: 'Test description',
      location: 'Test Location',
      sourceType: 'ics',
      sourceId: 'test-source',
      sourceName: 'Test Calendar',
      color: '#4C6FFF',
    });
    expect(events[0].start).toBeInstanceOf(Date);
    expect(events[0].end).toBeInstanceOf(Date);
  });

  it('should handle 304 Not Modified response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 304,
    });

    const events = await adapter.fetchEvents(mockSource);
    expect(events).toHaveLength(0);
  });

  it('should handle HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(adapter.fetchEvents(mockSource)).rejects.toThrow('HTTP 404: Not Found');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    await expect(adapter.fetchEvents(mockSource)).rejects.toThrow('Network timeout');
  });

  it('should parse date-only events as all-day', async () => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:all-day-event@example.com
DTSTART:20241009
DTEND:20241010
SUMMARY:All Day Event
END:VEVENT
END:VCALENDAR`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(icsContent),
    });

    const events = await adapter.fetchEvents(mockSource);
    expect(events[0].allDay).toBe(true);
  });

  it('should decode ICS values correctly', async () => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:encoded-event@example.com
DTSTART:20241009T140000Z
DTEND:20241009T150000Z
SUMMARY:Event with\\, commas and\\n newlines
DESCRIPTION:Description with\\, special\\; characters
END:VEVENT
END:VCALENDAR`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(icsContent),
    });

    const events = await adapter.fetchEvents(mockSource);
    expect(events[0].title).toBe('Event with, commas and\n newlines');
    expect(events[0].description).toBe('Description with, special; characters');
  });
});
