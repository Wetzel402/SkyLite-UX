import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CalDAVAdapter } from '~/server/services/calendar/adapters/caldav';
import { ConflictError, WriteNotAllowedError, QuotaExceededError } from '~/server/services/calendar/errors';

// Mock tsdav
vi.mock('tsdav', () => ({
  createDAVClient: vi.fn(() => ({
    findCalendarHome: vi.fn(),
    findCalendars: vi.fn(),
    createCalendarObject: vi.fn(),
    updateCalendarObject: vi.fn(),
    deleteCalendarObject: vi.fn(),
  }))
}));

// Mock environment variables
const originalEnv = process.env;

describe('CalDAV Write Operations', () => {
  let adapter: CalDAVAdapter;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment
    process.env = { ...originalEnv };
    
    adapter = new CalDAVAdapter();
    
    // Setup mock client
    const { createDAVClient } = require('tsdav');
    mockClient = {
      findCalendarHome: vi.fn(),
      findCalendars: vi.fn(),
      createCalendarObject: vi.fn(),
      updateCalendarObject: vi.fn(),
      deleteCalendarObject: vi.fn(),
    };
    createDAVClient.mockReturnValue(mockClient);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createEvent', () => {
    const mockSource = {
      id: 'test-source',
      name: 'Test Source',
      type: 'caldav',
      writePolicy: 'write',
      credentials: {
        username: 'testuser',
        password: 'testpass',
        serverUrl: 'https://caldav.example.com',
        calendarName: 'Test Calendar'
      }
    };

    const mockCalendar = {
      url: 'https://caldav.example.com/calendars/testuser/Test%20Calendar/',
      displayName: 'Test Calendar'
    };

    beforeEach(() => {
      mockClient.findCalendarHome.mockResolvedValue('https://caldav.example.com/calendars/testuser/');
      mockClient.findCalendars.mockResolvedValue([mockCalendar]);
    });

    it('should create event successfully when writes are enabled', async () => {
      process.env.CALDAV_WRITE_ENABLED = 'true';
      
      mockClient.createCalendarObject.mockResolvedValue({
        etag: 'test-etag-123'
      });

      const result = await adapter.createEvent(mockSource, {
        title: 'Test Event',
        description: 'Test Description',
        start: new Date('2024-01-01T10:00:00Z'),
        end: new Date('2024-01-01T11:00:00Z'),
        allDay: false
      });

      expect(result).toEqual({
        uid: expect.stringMatching(/^skylite-\d+-[a-z0-9]+$/),
        etag: 'test-etag-123'
      });

      expect(mockClient.createCalendarObject).toHaveBeenCalledWith({
        calendar: mockCalendar,
        filename: expect.stringMatching(/^skylite-\d+-[a-z0-9]+\.ics$/),
        iCalString: expect.stringContaining('BEGIN:VCALENDAR')
      });
    });

    it('should throw WriteNotAllowedError when writes are disabled globally', async () => {
      process.env.CALDAV_WRITE_ENABLED = 'false';

      await expect(adapter.createEvent(mockSource, {
        title: 'Test Event',
        start: new Date('2024-01-01T10:00:00Z'),
        end: new Date('2024-01-01T11:00:00Z')
      })).rejects.toThrow(WriteNotAllowedError);
    });

    it('should throw WriteNotAllowedError when source writePolicy is none', async () => {
      process.env.CALDAV_WRITE_ENABLED = 'true';
      
      const readOnlySource = { ...mockSource, writePolicy: 'none' };

      await expect(adapter.createEvent(readOnlySource, {
        title: 'Test Event',
        start: new Date('2024-01-01T10:00:00Z'),
        end: new Date('2024-01-01T11:00:00Z')
      })).rejects.toThrow(WriteNotAllowedError);
    });

    it('should simulate success in dry-run mode', async () => {
      process.env.CALDAV_WRITE_ENABLED = 'true';
      process.env.CALDAV_DRY_RUN = 'true';

      const result = await adapter.createEvent(mockSource, {
        title: 'Test Event',
        start: new Date('2024-01-01T10:00:00Z'),
        end: new Date('2024-01-01T11:00:00Z')
      });

      expect(result).toEqual({
        uid: expect.stringMatching(/^dry-run-\d+$/),
        etag: expect.stringMatching(/^dry-run-etag-\d+$/)
      });

      expect(mockClient.createCalendarObject).not.toHaveBeenCalled();
    });

    it('should handle server errors gracefully', async () => {
      process.env.CALDAV_WRITE_ENABLED = 'true';
      
      mockClient.createCalendarObject.mockRejectedValue(new Error('Server error'));

      await expect(adapter.createEvent(mockSource, {
        title: 'Test Event',
        start: new Date('2024-01-01T10:00:00Z'),
        end: new Date('2024-01-01T11:00:00Z')
      })).rejects.toThrow('Server error');
    });
  });

  describe('updateEvent', () => {
    const mockSource = {
      id: 'test-source',
      name: 'Test Source',
      type: 'caldav',
      writePolicy: 'write',
      credentials: {
        username: 'testuser',
        password: 'testpass',
        serverUrl: 'https://caldav.example.com',
        calendarName: 'Test Calendar'
      }
    };

    const mockEvent = {
      id: 'test-event',
      uid: 'test-uid-123',
      title: 'Original Title',
      description: 'Original Description',
      start: new Date('2024-01-01T10:00:00Z'),
      end: new Date('2024-01-01T11:00:00Z'),
      allDay: false,
      lastRemoteEtag: 'original-etag-123'
    };

    const mockCalendar = {
      url: 'https://caldav.example.com/calendars/testuser/Test%20Calendar/',
      displayName: 'Test Calendar'
    };

    beforeEach(() => {
      mockClient.findCalendarHome.mockResolvedValue('https://caldav.example.com/calendars/testuser/');
      mockClient.findCalendars.mockResolvedValue([mockCalendar]);
    });

    it('should update event successfully', async () => {
      process.env.CALDAV_WRITE_ENABLED = 'true';
      
      mockClient.updateCalendarObject.mockResolvedValue({
        etag: 'updated-etag-456'
      });

      const result = await adapter.updateEvent(mockSource, mockEvent, {
        title: 'Updated Title',
        description: 'Updated Description'
      });

      expect(result).toEqual({
        uid: 'test-uid-123',
        etag: 'updated-etag-456'
      });

      expect(mockClient.updateCalendarObject).toHaveBeenCalledWith({
        calendar: mockCalendar,
        filename: 'test-uid-123.ics',
        iCalString: expect.stringContaining('BEGIN:VCALENDAR'),
        headers: {
          'If-Match': 'original-etag-123'
        }
      });
    });

    it('should throw ConflictError on 412 response', async () => {
      process.env.CALDAV_WRITE_ENABLED = 'true';
      
      const conflictError = new Error('412 Precondition Failed');
      mockClient.updateCalendarObject.mockRejectedValue(conflictError);

      await expect(adapter.updateEvent(mockSource, mockEvent, {
        title: 'Updated Title'
      })).rejects.toThrow(ConflictError);
    });

    it('should simulate success in dry-run mode', async () => {
      process.env.CALDAV_WRITE_ENABLED = 'true';
      process.env.CALDAV_DRY_RUN = 'true';

      const result = await adapter.updateEvent(mockSource, mockEvent, {
        title: 'Updated Title'
      });

      expect(result).toEqual({
        uid: 'test-uid-123',
        etag: expect.stringMatching(/^dry-run-etag-\d+$/)
      });

      expect(mockClient.updateCalendarObject).not.toHaveBeenCalled();
    });
  });

  describe('deleteEvent', () => {
    const mockSource = {
      id: 'test-source',
      name: 'Test Source',
      type: 'caldav',
      writePolicy: 'write',
      credentials: {
        username: 'testuser',
        password: 'testpass',
        serverUrl: 'https://caldav.example.com',
        calendarName: 'Test Calendar'
      }
    };

    const mockEvent = {
      id: 'test-event',
      uid: 'test-uid-123',
      title: 'Test Event',
      start: new Date('2024-01-01T10:00:00Z'),
      end: new Date('2024-01-01T11:00:00Z'),
      lastRemoteEtag: 'original-etag-123'
    };

    const mockCalendar = {
      url: 'https://caldav.example.com/calendars/testuser/Test%20Calendar/',
      displayName: 'Test Calendar'
    };

    beforeEach(() => {
      mockClient.findCalendarHome.mockResolvedValue('https://caldav.example.com/calendars/testuser/');
      mockClient.findCalendars.mockResolvedValue([mockCalendar]);
    });

    it('should delete event successfully', async () => {
      process.env.CALDAV_WRITE_ENABLED = 'true';
      
      mockClient.deleteCalendarObject.mockResolvedValue({});

      await adapter.deleteEvent(mockSource, mockEvent);

      expect(mockClient.deleteCalendarObject).toHaveBeenCalledWith({
        calendar: mockCalendar,
        filename: 'test-uid-123.ics',
        headers: {
          'If-Match': 'original-etag-123'
        }
      });
    });

    it('should treat 404 as success (event already deleted)', async () => {
      process.env.CALDAV_WRITE_ENABLED = 'true';
      
      const notFoundError = new Error('404 Not Found');
      mockClient.deleteCalendarObject.mockRejectedValue(notFoundError);

      await expect(adapter.deleteEvent(mockSource, mockEvent)).resolves.not.toThrow();
    });

    it('should throw ConflictError on 412 response', async () => {
      process.env.CALDAV_WRITE_ENABLED = 'true';
      
      const conflictError = new Error('412 Precondition Failed');
      mockClient.deleteCalendarObject.mockRejectedValue(conflictError);

      await expect(adapter.deleteEvent(mockSource, mockEvent)).rejects.toThrow(ConflictError);
    });

    it('should simulate success in dry-run mode', async () => {
      process.env.CALDAV_WRITE_ENABLED = 'true';
      process.env.CALDAV_DRY_RUN = 'true';

      await expect(adapter.deleteEvent(mockSource, mockEvent)).resolves.not.toThrow();

      expect(mockClient.deleteCalendarObject).not.toHaveBeenCalled();
    });
  });

  describe('VEVENT content generation', () => {
    it('should generate valid VEVENT content for all-day event', () => {
      const event = {
        uid: 'test-uid',
        title: 'All Day Event',
        description: 'Test Description',
        location: 'Test Location',
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-02T00:00:00Z'),
        allDay: true
      };

      // Access private method for testing
      const content = (adapter as any).createVEVENTContent(event);

      expect(content).toContain('BEGIN:VCALENDAR');
      expect(content).toContain('BEGIN:VEVENT');
      expect(content).toContain('UID:test-uid');
      expect(content).toContain('SUMMARY:All Day Event');
      expect(content).toContain('DESCRIPTION:Test Description');
      expect(content).toContain('LOCATION:Test Location');
      expect(content).toContain('DTSTART;VALUE=DATE:20240101');
      expect(content).toContain('DTEND;VALUE=DATE:20240102');
      expect(content).toContain('STATUS:CONFIRMED');
      expect(content).toContain('END:VEVENT');
      expect(content).toContain('END:VCALENDAR');
    });

    it('should generate valid VEVENT content for timed event', () => {
      const event = {
        uid: 'test-uid',
        title: 'Timed Event',
        start: new Date('2024-01-01T10:00:00Z'),
        end: new Date('2024-01-01T11:00:00Z'),
        allDay: false
      };

      const content = (adapter as any).createVEVENTContent(event);

      expect(content).toContain('DTSTART:20240101T100000Z');
      expect(content).toContain('DTEND:20240101T110000Z');
    });

    it('should encode special characters in ICS values', () => {
      const event = {
        uid: 'test-uid',
        title: 'Event with; special, characters',
        description: 'Description with\nnewlines',
        start: new Date('2024-01-01T10:00:00Z'),
        end: new Date('2024-01-01T11:00:00Z'),
        allDay: false
      };

      const content = (adapter as any).createVEVENTContent(event);

      expect(content).toContain('SUMMARY:Event with\\; special\\, characters');
      expect(content).toContain('DESCRIPTION:Description with\\nnewlines');
    });
  });
});
