import type { H3Event } from "h3";

import { merge } from "lodash";

export function createMockH3Event(partialEvent: Partial<H3Event> & {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  method?: string;
}): H3Event {
  const method = partialEvent.method || (partialEvent as { node?: { req?: { method?: string } } }).node?.req?.method || "GET";
  const query = partialEvent.query || {};
  const event = {
    method,
    node: {
      req: {
        headers: { "content-type": "application/json" },
        method,
      },
      res: partialEvent.node?.res || {},
    },
    context: {
      params: partialEvent.params || {},
      query: query,
    },
    _requestBody: partialEvent.body,
  } as unknown as H3Event;

  const merged = merge(event, partialEvent) as H3Event;
  merged.context = merged.context || {};
  merged.context.query = query as Record<string, string | undefined>;
  merged.context.params = (merged.context.params || partialEvent.params || {}) as Record<string, string>;
  return merged;
}
