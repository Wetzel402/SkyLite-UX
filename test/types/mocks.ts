export type PrismaTransactionMock = {
  todo: {
    aggregate: ReturnType<typeof import("vitest").vi.fn>;
    delete: ReturnType<typeof import("vitest").vi.fn>;
    create: ReturnType<typeof import("vitest").vi.fn>;
    findFirst: ReturnType<typeof import("vitest").vi.fn>;
    findMany: ReturnType<typeof import("vitest").vi.fn>;
    update: ReturnType<typeof import("vitest").vi.fn>;
    updateMany: ReturnType<typeof import("vitest").vi.fn>;
    deleteMany: ReturnType<typeof import("vitest").vi.fn>;
  };
};

export type MockH3EventBody = Record<string, unknown>;
export type MockH3EventParams = Record<string, string>;
export type MockH3EventQuery = Record<string, string | undefined>;
