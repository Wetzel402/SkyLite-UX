import { consola } from 'consola';
import { defineNitroPlugin } from 'nitropack/runtime/plugin';
import { PrismaClient } from '@prisma/client';
import { PersistentCalendarSyncService } from '../services/calendar/persistent-sync';
import { getEventMergerService } from '../services/calendar/event-merger';

let persistentSyncService: PersistentCalendarSyncService;
let eventMergerService: any;

export default defineNitroPlugin(async (nitroApp) => {
  consola.start('Persistent Sync: Initializing...');

  try {
    // Initialize Prisma client
    const prisma = new PrismaClient();
    
    // Initialize persistent sync service
    persistentSyncService = new PersistentCalendarSyncService(prisma);
    
    // Initialize event merger service
    eventMergerService = getEventMergerService(prisma, persistentSyncService);

    // Start the sync service
    await persistentSyncService.start();

    // Make services available globally
    nitroApp.hooks.hook('request', (event) => {
      event.context.persistentSyncService = persistentSyncService;
      event.context.eventMergerService = eventMergerService;
      event.context.prisma = prisma;
    });

    consola.success('Persistent Sync: Initialized successfully');

  } catch (error) {
    consola.error('Persistent Sync: Failed to initialize:', error);
  }
});

