import { describe, it, expect } from 'vitest';
import { 
  getTestWeekData, 
  getTestUsers, 
  getTestEvents, 
  getMockEventsResponse,
  getTestEnv,
  formatDateForDisplay,
  formatTimeForDisplay
} from '../utils/test-data';

describe('Test Data Utilities', () => {
  it('generates consistent week data', () => {
    const weekData = getTestWeekData();
    
    expect(weekData.startOfWeek).toBeInstanceOf(Date);
    expect(weekData.endOfWeek).toBeInstanceOf(Date);
    expect(weekData.weekDates).toHaveLength(7);
    expect(weekData.today).toBeInstanceOf(Date);
    
    // Check that start of week is before end of week
    expect(weekData.startOfWeek.getTime()).toBeLessThan(weekData.endOfWeek.getTime());
  });

  it('generates test users with required fields', () => {
    const users = getTestUsers();
    
    expect(users).toHaveLength(3);
    users.forEach(user => {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('color');
      expect(user.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('generates test events with required fields', () => {
    const events = getTestEvents();
    
    expect(events.length).toBeGreaterThan(0);
    events.forEach(event => {
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('title');
      expect(event).toHaveProperty('start');
      expect(event).toHaveProperty('end');
      expect(event).toHaveProperty('allDay');
      expect(event).toHaveProperty('color');
      expect(event).toHaveProperty('userId');
      expect(event.start).toBeInstanceOf(Date);
      expect(event.end).toBeInstanceOf(Date);
    });
  });

  it('generates mock API response', () => {
    const response = getMockEventsResponse();
    
    expect(response).toHaveProperty('events');
    expect(response).toHaveProperty('weekStart');
    expect(response).toHaveProperty('weekEnd');
    expect(response).toHaveProperty('totalEvents');
    expect(response).toHaveProperty('lastUpdated');
    
    expect(Array.isArray(response.events)).toBe(true);
    expect(typeof response.weekStart).toBe('string');
    expect(typeof response.weekEnd).toBe('string');
    expect(typeof response.totalEvents).toBe('number');
    expect(typeof response.lastUpdated).toBe('string');
  });

  it('generates test environment variables', () => {
    const env = getTestEnv();
    
    expect(env.NODE_ENV).toBe('test');
    expect(env.ENABLE_KIOSK_MODE).toBe('true');
    expect(env.DISPLAY_TOKEN).toBe('test-token-123');
    expect(env.DATABASE_URL).toContain('skylite_test');
  });

  it('formats dates correctly', () => {
    const date = new Date('2024-10-09T15:30:00Z');
    
    const formattedDate = formatDateForDisplay(date);
    const formattedTime = formatTimeForDisplay(date);
    
    expect(formattedDate).toContain('October');
    expect(formattedDate).toContain('2024');
    expect(formattedTime).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('generates deterministic test data', () => {
    const users1 = getTestUsers();
    const users2 = getTestUsers();
    
    expect(users1).toEqual(users2);
    
    const events1 = getTestEvents();
    const events2 = getTestEvents();
    
    expect(events1).toEqual(events2);
  });
});
