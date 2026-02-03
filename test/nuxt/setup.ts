/// <reference path="./global.d.ts" />

import type { H3Event } from "h3";

import { vi } from "vitest";

import type { GlobalH3Functions } from "../types/h3-test";

export function useH3TestUtils() {
  const globalH3 = globalThis as unknown as GlobalH3Functions;
  const h3 = {
    defineEventHandler: vi.mocked(globalH3.defineEventHandler),
    readBody: vi.mocked(globalH3.readBody),
    getRouterParams: vi.mocked(globalH3.getRouterParams),
    getRouterParam: vi.mocked(globalH3.getRouterParam),
    getQuery: vi.mocked(globalH3.getQuery),
  };

  return h3;
}
