import type { Middleware } from 'koa';
import env from '../utils/env.ts';

export const auth: Middleware = async (ctx, next) => {
  // Only enable if provided env.
  if (!env.API_AUTH_TOKEN) {
    await next();
    return;
  }

  if (!ctx.headers.authorization) {
    ctx.status = 401;
    return;
  }
  if (ctx.headers.authorization !== `Bearer ${env.API_AUTH_TOKEN}`) {
    ctx.status = 403;
    return;
  }

  await next();
};
