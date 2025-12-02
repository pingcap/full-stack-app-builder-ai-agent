import { randomUUID } from 'crypto';
import type { Middleware } from 'koa';

export interface RequestIdContextHelpers {
  readonly requestId: string;
}

export function requestId<State, ResponseBody> () {
  const requestIdSupport: Middleware<State, RequestIdContextHelpers, ResponseBody> = (ctx, next: () => Promise<void>) => {
    Object.defineProperty(ctx, 'requestId', {
      value: randomUUID(),
      writable: false,
      enumerable: true,
      configurable: false,
    });
    ctx.set('X-Request-Id', ctx.requestId);
    return next();
  };

  return requestIdSupport;
}
