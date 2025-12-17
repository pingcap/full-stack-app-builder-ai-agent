import { bodyParser } from '@koa/bodyparser';
import Router from '@koa/router';
import type { AfterContextHelpers } from '../../koa/after.ts';

const router = new Router<{}, AfterContextHelpers>();

export default router;

router.all('/v1/echo', bodyParser(), async (ctx) => {
  const info = {
    method: ctx.method,
    query: ctx.query,
    headers: ctx.headers,
    body: ctx.request.body,
  };
  ctx.body = JSON.stringify(info);

  ctx.logger.debug('echo', info);
});
