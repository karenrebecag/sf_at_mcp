import type { IncomingMessage, ServerResponse } from 'node:http';

export interface ApiContext {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  searchParams: URLSearchParams;
  body: unknown;
  params: Record<string, string>;
}

export type ApiHandler = (ctx: ApiContext) => Promise<void>;

export interface ApiRoute {
  method: string;
  /** Path pattern relative to /api, e.g. "/org" or "/describe/:sobject" */
  pattern: string;
  handler: ApiHandler;
}
