import { AsyncLocalStorage } from 'node:async_hooks';

import type { NextFunction, Request, Response } from 'express';

import { type RequestMeta, requestMeta } from './request-meta';

const storage = new AsyncLocalStorage<RequestMeta>();

/** Express middleware: makes the request's IP and user agent available to the code it calls. */
export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  storage.run(requestMeta(req), next);
}

/** IP and user agent of the HTTP request being handled, or null outside a request. */
export function currentRequestMeta(): RequestMeta | null {
  return storage.getStore() ?? null;
}
