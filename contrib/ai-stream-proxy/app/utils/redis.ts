import { createClient } from 'redis';
import env from './env.ts';

export function getRedisClient () {
  return createClient({
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
    database: env.REDIS_DATABASE,
  });
}