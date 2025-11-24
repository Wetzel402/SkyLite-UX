import { describe, expect, vi, it } from "vitest";
import prisma from "~/lib/__mocks__/prisma";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { createMockH3Event } from "~~/test/nuxt/mocks/h3-event";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

// Mock the recurrence utility
vi.mock("~~/server/utils/recurrence", () => ({
  calculateNextDueDate: vi.fn((pattern, _lastDate, referenceDate) => {
    const nextDate = new Date(referenceDate || new Date());
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate;
  }),
}));

describe("PUT /api/todos/[id]", async () => {
  const handler = await import("~~/server/api/todos/[id].put");

  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  // Test data factories
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
    recurrencePattern: null,
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
    recurrencePattern: null,
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
            recurrencePattern: { type: "DAILY", interval: 1 },
          }),
        expectedUpdate: (
          base: ReturnType<typeof createBaseExpectedUpdate>,
        ) => ({
          ...base,
          completed: true,
          recurrencePattern: { type: "DAILY", interval: 1 },
          recurringGroupId: "group-1",
        }),
        expectRecurrence: true,
      },
      {
        name: "adding recurrence pattern generates recurringGroupId",
        params: { id: "todo-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          recurrencePattern: {
            type: "WEEKLY",
            interval: 1,
            daysOfWeek: [1, 3, 5],
          },
        }),
        currentTodo: () => createBaseTodo(),
        expectedUpdate: (
          base: ReturnType<typeof createBaseExpectedUpdate>,
        ) => ({
          ...base,
          recurrencePattern: {
            type: "WEEKLY",
            interval: 1,
            daysOfWeek: [1, 3, 5],
          },
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
          prisma.todo.aggregate.mockResolvedValue({ _max: { order: 5 } });
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

        const response = await handler.default(event);

        // Verify findUnique was called
        expect(prisma.todo.findUnique).toHaveBeenCalledWith({
          where: { id: params.id },
        });

        // Verify update was called with correct data
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
          // Verify next instance was created
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

  describe("error handling", () => {
    it("throws 400 when id is missing", async () => {
      const event = createMockH3Event({
        params: {},
        body: { title: "Test" },
      });

      await expect(handler.default(event)).rejects.toThrow();
    });

    it("throws 404 when todo not found", async () => {
      prisma.todo.findUnique.mockResolvedValue(null);

      const event = createMockH3Event({
        params: { id: "nonexistent" },
        body: { title: "Test" },
      });

      await expect(handler.default(event)).rejects.toThrow();
    });
  });
});
