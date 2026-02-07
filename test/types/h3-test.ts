import type { EventHandlerRequest, H3Event } from "h3";

export type Handler = (event: H3Event<EventHandlerRequest>) => Promise<unknown>;

export type GlobalH3Functions = {
  defineEventHandler: (handler: Handler) => Handler;
  readBody: (event: H3Event) => Promise<unknown>;
  getRouterParams: (event: H3Event) => Record<string, string>;
  getRouterParam: (event: H3Event, name: string) => string | undefined;
  getQuery: (event: H3Event) => Record<string, string | undefined>;
};
