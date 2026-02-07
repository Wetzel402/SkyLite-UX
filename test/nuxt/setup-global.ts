import type { H3Event } from "h3";

import { vi } from "vitest";

import type { Handler } from "../types/h3-test";

const defineEventHandlerMock = vi.fn((handler: Handler) => handler);
const readBodyMock = vi.fn(async (event: H3Event) => {
  if (event._requestBody && typeof event._requestBody === "string") {
    return JSON.parse(event._requestBody);
  }
  return event._requestBody || {};
});
const getRouterParamsMock = vi.fn((event: H3Event) => event.context?.params || {});
const getRouterParamMock = vi.fn(
  (event: H3Event, name: string) => event.context?.params?.[name],
);
const getQueryMock = vi.fn((event: H3Event) => event.context?.query || {});
const setResponseHeadersMock = vi.fn((event: H3Event, headers: Record<string, string>) => {
  if (event.node.res && typeof event.node.res.setHeader === "function") {
    Object.entries(headers).forEach(([key, value]) => {
      event.node.res.setHeader(key, value);
    });
  }
});

vi.stubGlobal("defineEventHandler", defineEventHandlerMock);
vi.stubGlobal("readBody", readBodyMock);
vi.stubGlobal("getRouterParams", getRouterParamsMock);
vi.stubGlobal("getRouterParam", getRouterParamMock);
vi.stubGlobal("getQuery", getQueryMock);
vi.stubGlobal("setResponseHeaders", setResponseHeadersMock);

class EventSourceMock {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  onopen: ((this: EventSourceMock, ev: Event) => void) | null = null;
  onmessage: ((this: EventSourceMock, ev: MessageEvent) => void) | null = null;
  onerror: ((this: EventSourceMock, ev: Event) => void) | null = null;
  readyState = EventSourceMock.CONNECTING;
  url = "";

  constructor(url: string) {
    this.url = url;
  }

  close(): void {
    this.readyState = EventSourceMock.CLOSED;
  }
}

if (typeof globalThis.EventSource === "undefined") {
  vi.stubGlobal("EventSource", EventSourceMock);
}
