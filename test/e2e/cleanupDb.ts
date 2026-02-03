import { PrismaClient } from "@prisma/client";
import { consola } from "consola";

const INTEGRATION_PREFIXES = [
  "E2E CRUD iCal ",
  "E2E CRUD Updated ",
  "Test iCal ",
  "Test Google Calendar ",
  "Test Mealie ",
  "Test Tandoor ",
] as const;

const USER_EMAIL_PREFIXES = [
  "e2e-test-",
  "original-",
  "updated-",
  "delete-",
] as const;

const CALENDAR_EVENT_TITLES = [
  "E2E Test Event",
  "All Day Event",
  "Original Event Title",
  "Updated Event Title",
  "Event to Delete",
  "Recurring Daily Event",
  "Weekly Meeting",
  "Original Recurring Event",
  "Updated Recurring Event",
  "Recurring Event to Delete",
] as const;

const TODO_COLUMN_NAMES = ["E2E Test Column"] as const;

const TODO_TITLES = [
  "E2E Test Todo",
  "Original Title",
  "Updated Title",
  "Todo to Delete",
  "Todo to Complete",
  "Todo 1",
  "Todo 2",
  "Recurring Daily Todo",
  "Recurring Weekly Todo",
  "Recurring Monthly Todo",
  "Recurring Yearly Todo",
] as const;

const SHOPPING_LIST_NAMES = [
  "E2E Test Shopping List",
  "Test List for Items",
  "Test List for Checking",
  "Test List for Editing",
  "Test List for Deletion",
  "List to Delete",
] as const;

export async function cleanupE2eDb(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }
  const prisma = new PrismaClient();
  try {
    const eventDeleted = await prisma.calendarEvent.deleteMany({
      where: {
        OR: CALENDAR_EVENT_TITLES.map((title) => ({ title })),
      },
    });
    const colDeleted = await prisma.todoColumn.deleteMany({
      where: {
        OR: TODO_COLUMN_NAMES.map((name) => ({ name })),
      },
    });
    const todoDeleted = await prisma.todo.deleteMany({
      where: {
        OR: TODO_TITLES.map((title) => ({ title })),
      },
    });
    const listDeleted = await prisma.shoppingList.deleteMany({
      where: {
        OR: SHOPPING_LIST_NAMES.map((name) => ({ name })),
      },
    });
    const intDeleted = await prisma.integration.deleteMany({
      where: {
        OR: INTEGRATION_PREFIXES.map((prefix) => ({
          name: { startsWith: prefix },
        })),
      },
    });
    const userDeleted = await prisma.user.deleteMany({
      where: {
        OR: USER_EMAIL_PREFIXES.map((prefix) => ({
          email: { startsWith: prefix },
        })),
      },
    });
    const total =
      eventDeleted.count +
      colDeleted.count +
      todoDeleted.count +
      listDeleted.count +
      intDeleted.count +
      userDeleted.count;
    if (total > 0) {
      consola.debug(
        `E2E cleanup: removed ${eventDeleted.count} events, ${colDeleted.count} todo columns, ${todoDeleted.count} todos, ${listDeleted.count} shopping lists, ${intDeleted.count} integrations, ${userDeleted.count} users`,
      );
    }
  } catch (e) {
    consola.warn("E2E cleanup: failed to delete test data:", e);
  } finally {
    await prisma.$disconnect();
  }
}
