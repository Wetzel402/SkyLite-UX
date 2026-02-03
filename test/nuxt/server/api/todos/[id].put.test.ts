import { Prisma } from "@prisma/client";
import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi, beforeEach } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/todos/[id].put";

import type { ICalEvent } from "~~/server/integrations/iCal/types";
import { calculateNextDueDate } from "~~/server/utils/rrule";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

vi.mock("~~/server/utils/rrule", () => ({
  calculateNextDueDate: vi.fn(
    (_rrule, originalDTSTART, _previousDueDate, referenceDate) => {
      const nextDate = new Date(referenceDate || originalDTSTART || new Date());
      nextDate.setDate(nextDate.getDate() + 1);
      return nextDate;
    },
  ),
}));

describe("pUT /api/todos/[id]", () => {

  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseTodo = (overrides = {}) => ({
    id: "todo-1",
    title: "Test Todo",
    description: "Test Description",
    priority: "MEDIUM" as const,
    dueDate: new Date("2025-11-25"),
    todoColumnId: "column-1",
    order: 1,
    completed: false,
    recurringGroupId: null,
    rrule: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createBaseTodoWithColumn = (overrides = {}) => ({
    ...createBaseTodo(overrides),
    todoColumn: {
      id: "column-1",
      name: "To Do",
      order: 1,
      isDefault: true,
      user: {
        id: "user-1",
        name: "Test User",
        avatar: null,
      },
    },
  });

  const createBaseUpdateBody = () => ({
    title: "Test Todo",
    description: "Test Description",
    priority: "MEDIUM" as const,
    completed: false,
    todoColumnId: "column-1",
    order: 1,
  });

  const createBaseExpectedUpdate = () => ({
    title: "Test Todo",
    description: "Test Description",
    priority: "MEDIUM" as const,
    completed: false,
    dueDate: new Date("2025-11-25"),
    todoColumnId: "column-1",
    order: 1,
    rrule: Prisma.JsonNull,
    recurringGroupId: null,
  });

  describe("updates todo successfully", () => {
    it.each([
      {
        name: "basic update without completion",
        params: { id: "todo-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          title: "Updated Title",
          description: "Updated Description",
          priority: "HIGH" as const,
        }),
        currentTodo: () => createBaseTodo(),
        expectedUpdate: (
          base: ReturnType<typeof createBaseExpectedUpdate>,
        ) => ({
          ...base,
          title: "Updated Title",
          description: "Updated Description",
          priority: "HIGH" as const,
          recurringGroupId: null,
        }),
        expectRecurrence: false,
      },
      {
        name: "update with due date change",
        params: { id: "todo-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          dueDate: "2025-12-31",
        }),
        currentTodo: () => createBaseTodo(),
        expectedUpdate: (
          base: ReturnType<typeof createBaseExpectedUpdate>,
        ) => ({
          ...base,
          dueDate: new Date("2025-12-31"),
          recurringGroupId: null,
        }),
        expectRecurrence: false,
      },
      {
        name: "completing recurring todo creates next instance",
        params: { id: "todo-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          completed: true,
          clientDate: "2025-11-25",
        }),
        currentTodo: () =>
          createBaseTodo({
            completed: false,
            recurringGroupId: "group-1",
            rrule: { freq: "DAILY", interval: 1 } as ICalEvent["rrule"],
            dueDate: new Date("2025-11-25"),
          }),
        expectedUpdate: (
          base: ReturnType<typeof createBaseExpectedUpdate>,
        ) => ({
          ...base,
          completed: true,
          rrule: { freq: "DAILY", interval: 1 } as ICalEvent["rrule"],
          recurringGroupId: "group-1",
        }),
        expectRecurrence: true,
      },
      {
        name: "adding recurrence pattern generates recurringGroupId",
        params: { id: "todo-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          rrule: {
            freq: "WEEKLY",
            interval: 1,
            byday: ["MO", "WE", "FR"],
          } as ICalEvent["rrule"],
        }),
        currentTodo: () => createBaseTodo(),
        expectedUpdate: (
          base: ReturnType<typeof createBaseExpectedUpdate>,
        ) => ({
          ...base,
          rrule: {
            freq: "WEEKLY",
            interval: 1,
            byday: ["MO", "WE", "FR"],
          } as ICalEvent["rrule"],
          recurringGroupId: expect.any(String),
        }),
        expectRecurrence: false,
      },
    ])(
      "$name",
      async ({
        params,
        body,
        currentTodo,
        expectedUpdate,
        expectRecurrence,
      }) => {
        const requestBody = body(createBaseUpdateBody());
        const mockCurrentTodo = currentTodo();
        const expectedUpdateData = expectedUpdate(createBaseExpectedUpdate());

        const mockResponse = createBaseTodoWithColumn({
          ...mockCurrentTodo,
          ...expectedUpdateData,
        });

        prisma.todo.findUnique.mockResolvedValue(mockCurrentTodo);
        prisma.todo.update.mockResolvedValue(mockResponse);

        if (expectRecurrence) {
          prisma.todo.findFirst.mockResolvedValue(
            createBaseTodo({
              id: "todo-0",
              dueDate: new Date("2025-11-25"),
            }),
          );
          prisma.todo.aggregate.mockResolvedValue({ _max: { order: 5 } } as Awaited<ReturnType<typeof prisma.todo.aggregate>>);
          prisma.todo.create.mockResolvedValue(
            createBaseTodo({
              id: "todo-2",
              order: 6,
              completed: false,
            }),
          );
        }

        const event = createMockH3Event({
          params,
          body: requestBody,
        });

        const response = await handler(event);

        expect(prisma.todo.findUnique).toHaveBeenCalledWith({
          where: { id: params.id },
        });

        expect(prisma.todo.update).toHaveBeenCalledWith({
          where: { id: params.id },
          data: expectedUpdateData,
          include: {
            todoColumn: {
              select: {
                id: true,
                name: true,
                order: true,
                isDefault: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        });

        if (expectRecurrence) {
          expect(prisma.todo.create).toHaveBeenCalled();
          expect(prisma.todo.aggregate).toHaveBeenCalledWith({
            where: {
              todoColumnId: mockCurrentTodo.todoColumnId,
              completed: false,
            },
            _max: {
              order: true,
            },
          });
        }

        expect(response).toEqual(mockResponse);
      },
    );
  });

  it("completing recurring todo when recurrence ended (until) does not create next", async () => {
    vi.mocked(calculateNextDueDate).mockReturnValueOnce(null);

    const mockCurrentTodo = createBaseTodo({
      completed: false,
      recurringGroupId: "group-1",
      rrule: {
        freq: "DAILY",
        interval: 1,
        until: "2025-11-30",
      } as ICalEvent["rrule"],
      dueDate: new Date("2025-11-30"),
    });

    const mockResponse = createBaseTodoWithColumn({
      ...mockCurrentTodo,
      completed: true,
      rrule: mockCurrentTodo.rrule,
      recurringGroupId: mockCurrentTodo.recurringGroupId,
    });

    prisma.todo.findUnique.mockResolvedValue(mockCurrentTodo);
    prisma.todo.update.mockResolvedValue(mockResponse);
    prisma.todo.findFirst.mockResolvedValue(
      createBaseTodo({
        id: "todo-0",
        dueDate: new Date("2025-11-25"),
      }),
    );

    const event = createMockH3Event({
      params: { id: "todo-1" },
      body: {
        ...createBaseUpdateBody(),
        completed: true,
        clientDate: "2025-11-30",
      },
    });

    const response = await handler(event);

    expect(prisma.todo.findUnique).toHaveBeenCalledWith({
      where: { id: "todo-1" },
    });
    expect(prisma.todo.update).toHaveBeenCalled();
    expect(prisma.todo.create).not.toHaveBeenCalled();
    expect(response).toEqual(mockResponse);
  });

  describe("error handling", () => {
    it("throws 400 when id is missing", async () => {
      const event = createMockH3Event({
        params: {},
        body: { title: "Test" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when todo not found", async () => {
      prisma.todo.findUnique.mockResolvedValue(null);

      const event = createMockH3Event({
        params: { id: "nonexistent" },
        body: { title: "Test" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });

  describe("timezone", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should handle todo completion and next occurrence calculation across timezones", async () => {
      const event = createMockH3Event({
        method: "PUT",
        body: {
          completed: true,
        },
        params: { id: "todo-1" },
      });

      prisma.todo.findUnique.mockResolvedValue({
        id: "todo-1",
        title: "Recurring Todo",
        description: null,
        priority: "MEDIUM",
        dueDate: new Date("2025-01-15T00:00:00Z"),
        order: 1,
        completed: false,
        todoColumnId: null,
        recurringGroupId: "group-1",
        rrule: { freq: "DAILY", interval: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prisma.todo.findFirst.mockResolvedValue({
        id: "todo-1",
        title: "Test Todo",
        description: null,
        priority: "MEDIUM",
        dueDate: new Date("2025-01-15T00:00:00Z"),
        order: 0,
        completed: false,
        todoColumnId: null,
        recurringGroupId: null,
        rrule: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prisma.todo.aggregate.mockResolvedValue({ _max: { order: 0 } } as Awaited<ReturnType<typeof prisma.todo.aggregate>>);

      prisma.todo.create.mockResolvedValue({
        id: "todo-2",
        title: "Recurring Todo",
        description: null,
        priority: "MEDIUM",
        dueDate: new Date("2025-01-16T00:00:00Z"),
        order: 1,
        completed: false,
        todoColumnId: null,
        recurringGroupId: "group-1",
        rrule: { freq: "DAILY", interval: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prisma.todo.update.mockResolvedValue({
        id: "todo-1",
        title: "Recurring Todo",
        description: null,
        priority: "MEDIUM",
        dueDate: new Date("2025-01-15T00:00:00Z"),
        order: 1,
        completed: true,
        todoColumnId: null,
        recurringGroupId: "group-1",
        rrule: { freq: "DAILY", interval: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await handler(event);
      expect(result.completed).toBe(true);
    });
  });
});
