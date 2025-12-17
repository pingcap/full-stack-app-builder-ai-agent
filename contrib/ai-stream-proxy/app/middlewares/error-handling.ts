import type { Middleware } from 'koa';
import { isNativeError } from 'node:util/types';
import type { LoggerContextHelpers } from '../koa/logger.ts';

const errorHandling: Middleware<{}, LoggerContextHelpers> = async (ctx, next) => {
  try {
    await next();
  } catch (e) {
    if (e instanceof Response) {
      ctx.body = e;
    } else if (e && typeof e === 'object' && (e as any).name === 'ZodError' && (e as any).issues?.length) {
      // Zod Error handling
      // Note: some dependencies maybe bundling zod itself.
      ctx.status = 400;
      ctx.body = {
        message: 'Validation failed',
        issues: (e as any).issues,
      };
    } else if (isAbortError(e)) {
      // pass
    } else {
      ctx.logger.error('Unhandled error', e);
      ctx.status = 500;
      ctx.body = {
        message: String((e as any)?.message ?? e ?? 'Unknown error'),
      };
    }
  }
};

export function isAbortError (e: unknown): e is Error {
  if (isNativeError(e)) {
    if (e.message === 'aborted' && (e as any).code === 'ECONNRESET') {
      return true;
    }
    if (e.message === 'The operation was aborted'
      && e.name === 'AbortError'
      && (e as any).code === 'ABORT_ERR'
      && isNativeError(e.cause)
      && (e.cause as any).code === 'ERR_STREAM_PREMATURE_CLOSE'
    ) {
      return true;
    }
  }
  return false;
}

export default errorHandling;