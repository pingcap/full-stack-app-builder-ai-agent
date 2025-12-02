import type { Middleware } from 'koa';
import { Logger, type LoggerContextHelpers } from './logger.ts';

export interface AfterContext {
  readonly logger: Logger;
}

export type AfterFn = (context: AfterContext) => (void | Promise<void>);
export type CleanupFn = (context: AfterContext) => (void | Promise<void>);

export interface AfterContextHelpers extends LoggerContextHelpers {
  after (debugName: string, fn: AfterFn): void;

  after (fn: AfterFn): void;

  after (arg0: string | AfterFn, arg1?: AfterFn): void;

  cleanup (fn: CleanupFn): void;

}

export function afterSupport<State, ResponseBody> () {
  const middleware: Middleware<State, AfterContextHelpers, ResponseBody> = async (ctx, next) => {
    const fns: AfterFn[] = [];
    const fnLabels: Map<AfterFn, string> = new Map();

    const cleanupFns: CleanupFn[] = [];

    function after (fn: AfterFn): void;
    function after (debugName: string, fn: AfterFn): void;
    function after (arg0: string | AfterFn, arg1?: AfterFn) {
      if (typeof arg0 === 'function') {
        fns.push(arg0);
        fnLabels.set(arg0, arg0.name);
      } else {
        if (!arg1) {
          throw new Error('after() missing function');
        }
        fns.push(arg1);
        fnLabels.set(arg1, arg0);
      }
    }

    function cleanup (fn: CleanupFn) {
      cleanupFns.push(fn);
    }

    Object.defineProperty(ctx, 'after', {
      value: after,
      enumerable: false,
      configurable: false,
      writable: false,
    });

    Object.defineProperty(ctx, 'cleanup', {
      value: cleanup,
      enumerable: false,
      configurable: false,
      writable: false,
    });

    const logger = ctx.logger.tag('after');
    const context = { logger } as const;
    try {
      await next();
    } finally {
      await Promise.allSettled(
        fns.map(async fn => {
          const label = fnLabels.get(fn);

          const ctx = label ? { ...context, logger: context.logger.tag(label) } : context;
          try {
            await fn(ctx);
          } catch (e) {
            ctx.logger.log('error', fnLabels.get(fn) || fn, `execution failed`, e);
          }
        }),
      );
      await Promise.allSettled(
        cleanupFns.map(async fn => {
          try {
            await fn(context);
          } catch (e) {
            logger.error('cleanup fn', fn, `execution failed`, e);
          }
        }),
      );
    }
  };

  return middleware;
}
