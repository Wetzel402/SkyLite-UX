#!/usr/bin/env node
/**
 * Test Database Seeding Script
 * Only runs when NODE_ENV=test
 * Creates deterministic test data for kiosk mode testing
 */

import { PrismaClient } from '@prisma/client';
import { consola } from 'consola';

// Ensure this only runs in test environment
if (process.env.NODE_ENV !== 'test') {
  consola.error('Seed script can only run in test environment');
  process.exit(1);
}

const prisma = new PrismaClient();

async function seedTestData() {
  try {
    consola.info('Seeding test database...');

    // Clear existing test data
    await prisma.calendarEventUser.deleteMany();
    await prisma.calendarEvent.deleteMany();
    await prisma.user.deleteMany();

    // Create test users
    const users = await Promise.all([
      prisma.user.create({
        data: {
          id: 'test-user-1',
          name: 'John Doe',
          email: 'john@example.com',
          color: '#EF4444', // Red
          todoOrder: 0,
        },
      }),
      prisma.user.create({
        data: {
          id: 'test-user-2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          color: '#10B981', // Green
          todoOrder: 1,
        },
      }),
      prisma.user.create({
        data: {
          id: 'test-user-3',
          name: 'Family Events',
          email: 'family@example.com',
          color: '#3B82F6', // Blue
          todoOrder: 2,
        },
      }),
    ]);

    consola.info(`Created ${users.length} test users`);

    // Get current week dates
    const today = new Date();
    const currentDay = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDates.push(date);
    }

    // Create test events for the current week
    const events = [
      {
        title: 'Morning Meeting',
        description: 'Team standup',
        start: new Date(weekDates[1]), // Monday
        end: new Date(weekDates[1].getTime() + 2 * 60 * 60 * 1000), // +2 hours
        allDay: false,
        color: { primary: '#EF4444' },
        location: 'Conference Room A',
        userId: users[0].id,
      },
      {
        title: 'Lunch with Family',
        description: 'Family lunch',
        start: new Date(weekDates[1].getTime() + 4 * 60 * 60 * 1000), // Monday +4 hours
        end: new Date(weekDates[1].getTime() + 5 * 60 * 60 * 1000), // +1 hour
        allDay: false,
        color: { primary: '#10B981' },
        location: 'Home',
        userId: users[1].id,
      },
      {
        title: 'Doctor Appointment',
        description: 'Annual checkup',
        start: new Date(weekDates[2]), // Tuesday
        end: new Date(weekDates[2].getTime() + 1 * 60 * 60 * 1000), // +1 hour
        allDay: false,
        color: { primary: '#3B82F6' },
        location: 'Medical Center',
        userId: users[2].id,
      },
      {
        title: 'Weekend Trip',
        description: 'Family vacation',
        start: new Date(weekDates[5]), // Saturday
        end: new Date(weekDates[6]), // Sunday
        allDay: true,
        color: { primary: '#8B5CF6' },
        location: 'Beach House',
        userId: users[2].id,
      },
      {
        title: 'Today\'s Event',
        description: 'Event happening today',
        start: new Date(today.getTime() + 2 * 60 * 60 * 1000), // Today +2 hours
        end: new Date(today.getTime() + 3 * 60 * 60 * 1000), // Today +3 hours
        allDay: false,
        color: { primary: '#F59E0B' },
        location: 'Office',
        userId: users[0].id,
      },
    ];

    // Create calendar events
    for (const eventData of events) {
      const { userId, ...eventFields } = eventData;
      
      const event = await prisma.calendarEvent.create({
        data: eventFields,
      });

      // Link event to user
      await prisma.calendarEventUser.create({
        data: {
          calendarEventId: event.id,
          userId: userId,
        },
      });
    }

    consola.info(`Created ${events.length} test events`);

    // Create some shopping lists for testing
    const shoppingList = await prisma.shoppingList.create({
      data: {
        name: 'Weekly Groceries',
        order: 0,
      },
    });

    const shoppingItems = [
      { name: 'Milk', quantity: 2, unit: 'gallons', checked: false },
      { name: 'Bread', quantity: 1, unit: 'loaf', checked: false },
      { name: 'Eggs', quantity: 12, unit: 'count', checked: true },
      { name: 'Apples', quantity: 6, unit: 'count', checked: false },
    ];

    for (const item of shoppingItems) {
      await prisma.shoppingListItem.create({
        data: {
          ...item,
          shoppingListId: shoppingList.id,
        },
      });
    }

    consola.info(`Created shopping list with ${shoppingItems.length} items`);

    consola.success('Test database seeded successfully!');
    consola.info('Test data includes:');
    consola.info(`- ${users.length} users with different colors`);
    consola.info(`- ${events.length} calendar events for current week`);
    consola.info(`- 1 shopping list with ${shoppingItems.length} items`);
    consola.info(`- Events span from ${weekDates[0].toDateString()} to ${weekDates[6].toDateString()}`);

  } catch (error) {
    consola.error('Failed to seed test database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestData();
}

export { seedTestData };
