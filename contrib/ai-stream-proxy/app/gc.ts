import type { StreamState } from './db/stream.v2.ts';
import { Logger } from './koa/logger.ts';
import env from './utils/env.ts';
import { getRedisClient } from './utils/redis.ts';

const gcFootprint = new Set<string>();

const gcLogger = new Logger({
  tags: ['gc'],
});

export async function gc () {
  let startedAt = Date.now();
  const redis = getRedisClient();

  try {
    gcLogger.log('debug', 'start');
    await redis.connect();
    const keys = await redis.keys('v2:stream:*:state');
    let i = 0;
    let visitedSomeone = false;
    let isTimeout = false;
    for (const key of keys) {
      if (gcFootprint.has(key)) {
        continue;
      }
      let metaStr = await redis.get(key);
      if (!metaStr) {
        continue;
      }
      const metaObj = JSON.parse(metaStr) as StreamState;
      visitedSomeone = true;
      if (Date.now() - metaObj.timestamp > env.GC_STREAM_MAX_AGE) {
        const streamId = key.slice('v2:stream:'.length, -':state'.length);
        await redis.del([
          `v2:stream:${streamId}:config`,
          `v2:stream:${streamId}:state`,
          `v2:stream:${streamId}:content`,
        ]);
        gcLogger.debug('release stream', streamId);
      } else {
        gcFootprint.add(key);
      }
      i += 1;
      if (i > env.GC_BATCH_SIZE) {
        break;
      }

      if (Date.now() - startedAt > env.GC_TIMEOUT) {
        gcLogger.debug('timeout');
        isTimeout = true;
        break;
      }
    }
    if (!isTimeout && !visitedSomeone) {
      gcFootprint.clear();
    }
  } catch (e) {
    gcLogger.warn('failed', e);
  } finally {
    void redis.close().catch(() => void 0);
  }
}

export function scheduleGC () {
  void gc();
  setInterval(gc, env.GC_INTERVAL);
}
