import type { Context } from 'koa';
import { getRedisClient } from '../utils/redis.ts';
import type { AfterContextHelpers } from './after.ts';
import { Logger, type LoggerContextHelpers } from './logger.ts';

export interface RedisContextHelpers extends AfterContextHelpers, LoggerContextHelpers {
  getRedis (label?: string): Promise<ReturnType<typeof getRedisClient>>;
}

export function redisSupport (ctx: RedisContextHelpers & Context, next: () => Promise<void>) {
  const logger = ctx.logger.tag('redis');
  let i = 0;

  async function getRedisImpl (label?: string) {
    const redisLogger = logger.tag(label || i.toString());
    i++;

    const debug = ctx.get('x-debug');

    const client = getRedisClient();

    client
      .on('error', (err) => {
        redisLogger.error('error', err);
      })
      .on('connect', () => {
        if (debug) {
          redisLogger.debug('connected');
        }
      });

    await client.connect();

    ctx.cleanup(async () => {
      if (client.isPubSubActive) {
        await client.unsubscribe();
      }

      if (client.isOpen) {
        client.destroy();
        if (debug) {
          redisLogger.debug('destroyed (cleanup)');
        }
      }
    });

    return client;
  }

  const helper = new RedisClientHelper(getRedisImpl, {
    executor: ctx.after,
    logger: logger,
  });

  Object.defineProperty(ctx, 'getRedis', {
    value: helper.getRedis.bind(helper),
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return next();
}

export interface RedisClientHelperOptions {
  logger?: Logger;
  ttl?: number;
  executor?: (fn: () => Promise<void>) => void;
}

export class RedisClientHelper {
  #redis?: ReturnType<typeof getRedisClient>;
  #activeAt: number;
  readonly #getRedis: (label?: string) => Promise<ReturnType<typeof getRedisClient>>;
  readonly #ttl: number;
  #ttlHandle?: NodeJS.Timeout;
  #logger: Logger;
  readonly #executor: (fn: () => Promise<void>) => void;

  constructor (
    connect: (label?: string) => Promise<ReturnType<typeof getRedisClient>>,
    {
      logger,
      ttl = 10000,
      executor,
    }: RedisClientHelperOptions = {},
  ) {
    this.#redis = undefined;
    this.#activeAt = 0;
    this.#getRedis = connect;
    this.#ttl = ttl;
    this.#logger = logger ?? new Logger({ tags: ['redis-helper-context'] });
    this.#executor = executor ?? ((fn) => fn().catch(e => this.#logger.error(e)));
  }

  activate () {
    this.#ttlHandle = setTimeout(() => {
      clearTimeout(this.#ttlHandle);
      const redis = this.#redis;
      if (!redis) {
        return;
      }
      this.#redis = undefined;
      this.#executor(() => this.#cleanup(redis));
    }, this.#ttl);
  }

  async getRedis (label?: string) {
    if (this.#redis) {
      if (Date.now() - this.#activeAt > this.#ttl) {
        const redis = this.#redis;
        this.#executor(() => this.#cleanup(redis));
      } else {
        return this.#redis;
      }
    }
    this.#redis = await this.#getRedis(label);
    this.activate();

    return this.#redis;
  }

  async #cleanup (redis: ReturnType<typeof getRedisClient>) {
    if (redis.isPubSubActive) {
      await redis.unsubscribe();
    }

    if (redis.isOpen) {
      await redis.close();
    }
  }
}
