import type { H3Event } from "h3";

import type { Handler } from "../types/h3-test";

declare global {
  function defineEventHandler(handler: Handler): Handler;
  function readBody(event: H3Event): Promise<unknown>;
  function getRouterParams(event: H3Event): Record<string, string>;
  function getRouterParam(event: H3Event, name: string): string | undefined;
  function getQuery(event: H3Event): Record<string, string | undefined>;
}

export {};
