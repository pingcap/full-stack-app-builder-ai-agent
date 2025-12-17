import { Readable } from 'node:stream';
import type { RedisContextHelpers } from '../koa/redis.ts';
import { decodeBoolRange, queryBoolRangePrefixRange } from '../utils/bool-range.ts';
import type { ReadStreamProvider, StreamMetadata } from './read-stream-provider.ts';

export function getRedisStreamProvider (ctx: RedisContextHelpers): ReadStreamProvider {
  return {
    async getStreamInfo (id: string): Promise<StreamMetadata | null> {
      const redis = await ctx.getRedis();
      const [configStr, stateStr] = await redis.multi()
        .get(`v2:stream:${id}:config`)
        .get(`v2:stream:${id}:state`)
        .execTyped();

      if (!stateStr || !configStr) {
        return null;
      }

      return {
        state: JSON.parse(stateStr),
        config: JSON.parse(configStr),
      };
    },
    createReadStream (metadata): Readable {
      const range = decodeBoolRange(Buffer.from(metadata.state.ranges, 'binary'));
      const length = queryBoolRangePrefixRange(range) || 0;
      return Readable.from(unsafeReadStream(ctx, metadata.config.io_chunk_size, metadata.config.stream_id, 0, length));
    },
    save (metadata: StreamMetadata, readable: AsyncIterable<Buffer>): Promise<void> {
      throw new Error('unsupported');
    },

    async cleanup (id: string): Promise<void> {
      const redis = await ctx.getRedis();
      await redis.multi()
        .del(`v2:stream:${id}:config`)
        .del(`v2:stream:${id}:content`)
        .del(`v2:stream:${id}:state`)
        .exec();
    },
  };
}

/**
 * This method will not check the stream state.
 */
async function* unsafeReadStream (ctx: RedisContextHelpers, ioChunkSize: number, streamId: string, offset: number, length: number) {
  const redis = await ctx.getRedis();

  if (length === 0) {
    return;
  }

  let cursor = offset;

  while (cursor < offset + length) {
    const end = Math.min(offset + length - 1, cursor + ioChunkSize - 1);

    const buff = await redis.getRange(`v2:stream:${streamId}:content`, cursor, end);

    if (buff == null) {
      throw new Error('chunk not found');
    }

    yield Buffer.from(buff, 'binary');

    cursor = end + 1;
  }
}
