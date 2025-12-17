import type { SDKMessage } from '@anthropic-ai/claude-code';
import { bodyParser } from '@koa/bodyparser';
import Router from '@koa/router';
import type { ThreadEvent } from '@openai/codex-sdk';
import { createStreamingUIMessageState, type StreamingUIMessageState, UI_MESSAGE_STREAM_HEADERS, type UIMessage, type UIMessageChunk } from 'ai';
import * as stream from 'node:stream';
import { PassThrough, Readable, Writable } from 'node:stream';
import type { StreamItem } from 'pantheon-tdd-sdk/stream-items';
import { WatchError } from 'redis';
import { z } from 'zod';
import { type StreamConfig, streamConfigSchema, type StreamState } from '../../db/stream.v2.ts';
import { decodeJsonLStream } from '../../formats/decoders.ts';
import { encodeVercelAIMessagesStream } from '../../formats/encoders.ts';
import type { AfterContextHelpers } from '../../koa/after.ts';
import type { RedisContextHelpers } from '../../koa/redis.ts';
import type { StreamProviderHelpers } from '../../providers/read-stream-provider.ts';
import { createBoolRange, decodeBoolRange, encodeBoolRange, expandBoolRange, queryBoolRangePrefixRange, queryBoolSetRangeFrom, setBoolRange } from '../../utils/bool-range.ts';
import { createSDKMessageToUIMessageTransformStream } from '../../utils/claude-code-transform.ts';
import { createCodexTransform } from '../../utils/codex-transform.ts';
import { fastReadUIMessageStream } from '../../utils/hack-vercel-ai.ts';
import { createPantheonTddTransform } from '../../utils/panthon-tdd-transform.ts';
import type { getRedisClient } from '../../utils/redis.ts';
import { webhookCallback } from '../../utils/webhook.ts';

const router = new Router<{}, RedisContextHelpers & StreamProviderHelpers>();

export default router;

const endStreamSignalSchema = z.object({
  stop_state: z.enum(['done', 'abort']),
  stop_reason: z.string().optional(),
  final_size: z.number().int().min(0),
});

router.get('/v2/stream-usage', async (ctx) => {
  const redis = await ctx.getRedis();
  const keys = await redis.keys('v2:stream:*:content');

  let sum = 0;
  let mul = redis.multi();

  for (const key of keys) {
    mul = mul.strLen(key) as any;
  }

  const sizes = await mul.execAsPipeline();

  ctx.body = {
    mem: sizes.reduce((sum, l) => sum + (l as unknown as number), 0),
  };
});

router.get('/v2/streams', async (ctx) => {
  const redis = await ctx.getRedis();
  const keys = await redis.keys('v2:stream:*:config');

  ctx.status = 200;
  ctx.body = keys.map((key) => key.slice('v2:stream:'.length, -':config'.length));
});

// Create stream
router.post('/v2/streams', bodyParser(), async (ctx) => {
  const redis = await ctx.getRedis();

  const config = streamConfigSchema.parse(ctx.request.body);

  if (await redis.get(`v2:stream:${config.stream_id}:config`)) {
    ctx.status = 409;
    ctx.body = `Stream ${config.stream_id} already exists.`;
    return;
  }

  await redis
    .multi()
    .set(`v2:stream:${config.stream_id}:config`, JSON.stringify(config))
    .set(`v2:stream:${config.stream_id}:state`, JSON.stringify({
      state: 'pending',
      final_size: 0,
      ranges: encodeBoolRange(createBoolRange(4096)).toString('binary'),
      timestamp: Date.now(),
    } satisfies StreamState))
    .exec();

  ctx.status = 201;
});

// Get stream config
router.get('/v2/streams/:stream_id', async (ctx) => {
  const redis = await ctx.getRedis();
  const config = await redis.get(`v2:stream:${ctx.params.stream_id}:config`);
  if (!config) {
    ctx.status = 404;
    return;
  }
  ctx.body = JSON.parse(config);
});

// Get stream state (for debug only)
router.get('/v2/streams/:stream_id/state', async (ctx) => {
  const redis = await ctx.getRedis();
  const stateStr = await redis.get(`v2:stream:${ctx.params.stream_id}:state`);
  if (!stateStr) {
    ctx.status = 404;
    return;
  }
  const state: StreamState = JSON.parse(stateStr);
  const maxReadableStreamLength = queryBoolRangePrefixRange(decodeBoolRange(Buffer.from(state.ranges, 'binary')));

  ctx.status = 200;
  ctx.body = {
    ...state,
    maxReadableStreamLength,
  };
});

// Global caches for concurrency writes
const _cachedBR: Map<string, {
  ctx: object,
  mutations: [start: number, end: number][]
}> = new Map();

// Put stream chunk
// Request with header:
//   X-Content-Range: bytes <inclusive start>-<inclusive end>
//   [Optional] X-Content-Hash: <md5 hash of the content>
// Request body must matches the range header.
router.put('/v2/streams/:stream_id/content', async (ctx) => {
  const stateKey = `v2:stream:${ctx.params.stream_id}:state`;
  const configKey = `v2:stream:${ctx.params.stream_id}:config`;
  const signalKey = `v2:stream:${ctx.params.stream_id}:signal`;

  ctx.disableRequestLog = true;
  const redis = await ctx.getRedis();
  const [stateStr, configStr] = await redis.multi()
    .get(stateKey)
    .get(configKey)
    .execTyped();

  if (stateStr == null || configStr == null) {
    ctx.status = 404;
    return;
  }

  const state: StreamState = JSON.parse(stateStr);
  const config: StreamConfig = JSON.parse(configStr);

  if (state.state !== 'pending' && state.state !== 'streaming') {
    ctx.status = 409;
    ctx.body = 'Stream is not in pending or streaming state.';
    return;
  }

  const contentRange = ctx.get('x-content-range');
  const contentHash = ctx.get('x-content-hash');

  if (!contentRange) {
    ctx.status = 422;
    ctx.body = 'single X-Content-Range header is required.';
    return;
  }

  const matched = /^bytes (\d+)-(\d+)$/.exec(contentRange);
  if (!matched) {
    ctx.status = 422;
    ctx.body = 'Invalid X-Content-Range header.';
    return;
  }

  const start = parseInt(matched[1]);
  const end = parseInt(matched[2]);

  if (start < 0 || end < 0 || start > end) {
    ctx.status = 422;
    ctx.body = 'Invalid X-Content-Range header.';
    return;
  }

  let offset = 0;
  for await (const chunk of ctx.req) {
    await redis.setRange(`v2:stream:${config.stream_id}:content`, start + offset, chunk);
    offset += chunk.length;
  }

  if (offset !== end - start + 1) {
    ctx.status = 422;
    ctx.body = `Content length does not match X-Content-Range header. (${offset} != ${end - start + 1})`;
    return;
  }

  const cached = _cachedBR.get(config.stream_id);

  if (cached) {
    cached.mutations.push([start, end]);
    ctx.status = 202;
    ctx.body = offset;
    return;
  }

  // OPTIMISTIC UPDATE
  while (true) {
    await redis.watch(stateKey);

    const currentStateStr = await redis.get(stateKey);
    if (!currentStateStr) {
      ctx.status = 500;
      ctx.response.body = 'Stream state lost while writing chunk.';
      return;
    }
    const currentState: StreamState = JSON.parse(currentStateStr);
    if (currentState.state !== 'pending' && currentState.state !== 'streaming') {
      ctx.status = 500;
      ctx.body = `Stream state changed to ${currentState.state} while writing chunk.`;
      return;
    }

    let ranges = decodeBoolRange(Buffer.from(currentState.ranges, 'binary'));
    let rangesStrings = [contentRange];

    ranges = expandBoolRange(ranges, end);
    setBoolRange(ranges, start, end);

    // Get and clean cache
    const _cached = _cachedBR.get(config.stream_id);
    _cached?.mutations.forEach(([start, end]) => {
      ranges = expandBoolRange(ranges, end);
      setBoolRange(ranges, start, end);
      rangesStrings.push(`bytes ${start}-${end}`);
    });
    _cachedBR.delete(config.stream_id);

    currentState.ranges = encodeBoolRange(ranges).toString('binary');
    currentState.state = 'streaming';
    currentState.timestamp = Date.now();

    try {
      await redis.multi()
        .set(stateKey, JSON.stringify(currentState))
        .publish(signalKey, rangesStrings.join('\n'))
        .exec();

      break;
    } catch (e) {
      if (e instanceof WatchError) {
        const cached = _cachedBR.get(config.stream_id);
        if (cached) {
          // Some other requests delayed, join non-processed ranges to that one.
          cached.mutations.push(
            [start, end],
            ..._cached?.mutations ?? [],
          );

          ctx.status = 202;
          ctx.body = offset;
          return;
        } else {
          // create a new cache
          _cachedBR.set(config.stream_id, {
            ctx,
            mutations: [
              ..._cached?.mutations ?? [],
            ],
          });
          continue;
        }
      }
      return Promise.reject(e);
    }
  }

  ctx.status = 200;
  ctx.body = offset;
});

// Download stream content (call only when finished.)
//    ?format=vercel-ai-ui-message
router.get('/v2/streams/:stream_id/content', async (ctx) => {
  const redis = await ctx.getRedis();

  let state: StreamState;
  let config: StreamConfig;

  const fsStream = await ctx.streams.fs.getStreamInfo(ctx.params.stream_id);
  if (fsStream) {
    state = fsStream.state;
    config = fsStream.config;
  } else {
    const metadata = await ctx.streams.redis.getStreamInfo(ctx.params.stream_id);
    if (metadata == null) {
      ctx.status = 404;
      return;
    }
    state = metadata.state;
    config = metadata.config;
  }

  if (state.state !== 'done' && state.state !== 'abort') {
    ctx.status = 409;
    ctx.body = 'Stream is not in done or abort state. Please use /v2/streams/:stream_id/events API to subscribe changes';
    return;
  }

  const format = ctx.request.query.format;

  const input = fsStream ? ctx.streams.fs.createReadStream({ state, config }) : ctx.streams.redis.createReadStream({ state, config });

  if (!format || format === 'opaque') {
    ctx.status = 200;
    ctx.set('Content-Type', 'application/octet-stream');
    ctx.set('Content-Length', `${state.final_size}`);

    await stream.promises.finished(input.pipe(ctx.res));
  } else if (format === 'vercel-ai-ui-message') {
    let result: Awaited<ReturnType<typeof collectMessage>>;

    switch (config.content_type) {
      case 'claude-code-stream-json+include-partial-messages':
        result = await collectMessage(config.message_id, decodeJsonLStream<SDKMessage>(Readable.toWeb(input), false).pipeThrough(createSDKMessageToUIMessageTransformStream(config.message_id)));
        break;
      case 'codex-stream-json':
        result = await collectMessage(config.message_id, decodeJsonLStream<ThreadEvent>(Readable.toWeb(input), false).pipeThrough(createCodexTransform(config.message_id)));
        break;
      case 'pantheon-tdd-stream-json':
        result = await collectMessage(config.message_id, decodeJsonLStream<StreamItem>(Readable.toWeb(input), false).pipeThrough(createPantheonTddTransform(config.message_id)));
        break
      default:
        ctx.status = 400;
        ctx.body = `Invalid content type ${config.content_type}.`;
        return;
    }
    ctx.status = 200;
    ctx.set('Content-Type', 'application/json');
    ctx.body = result.state.message;
  } else {
    ctx.status = 409;
    ctx.body = `Invalid format ${format}.`;
  }
});

// Close a stream,
// {
//   stop_state: 'done',
//   final_size: <size>
// }
// or
// {
//   stop_state: 'abort',
//   stop_reason?: 'some reason',
//   final_size: <size>
// }
router.post('/v2/streams/:stream_id/actions/stop', bodyParser(), async (ctx) => {
  const redis = await ctx.getRedis();
  const stateStr = await redis.get(`v2:stream:${ctx.params.stream_id}:state`);
  const configStr = await redis.get(`v2:stream:${ctx.params.stream_id}:config`);
  if (stateStr == null || configStr == null) {
    ctx.status = 404;
    return;
  }
  const state: StreamState = JSON.parse(stateStr);
  const config: StreamConfig = JSON.parse(configStr);

  const { stop_state, stop_reason, final_size } = endStreamSignalSchema.parse(ctx.request.body);

  if (state.state !== 'pending' && state.state !== 'streaming') {
    ctx.status = 409;
    ctx.body = 'Stream is not in pending or streaming state.';
    return;
  }

  // Validate final_size if stop_state is done.
  const range = queryBoolRangePrefixRange(decodeBoolRange(Buffer.from(state.ranges, 'binary')));

  state.state = stop_state;
  state.stop_reason = stop_reason;
  state.final_size = range ? range + 1 : 0;

  await redis
    .multi()
    .set(`v2:stream:${config.stream_id}:state`, JSON.stringify(state))
    .publish(`v2:stream:${config.stream_id}:signal`, stop_state)
    .exec();

  if (stop_state === 'done') {
    switch (config.content_type) {
      case 'claude-code-stream-json+include-partial-messages':
        ctx.after('webhook', async ({ logger }) => {
          const result = await collectMessage(
            config.message_id,
            decodeJsonLStream<SDKMessage>(Readable.toWeb(ctx.streams.redis.createReadStream({ state, config })), true)
              .pipeThrough(createSDKMessageToUIMessageTransformStream(config.message_id)),
          );

          if (result) {
            logger.info(`sending ui-message with`, result.state.message.parts.length, 'parts from stream', config.stream_id);
            await webhookCallback('stream-done', {
              message: result.state.message,
              streamId: config.stream_id,
              serverMessageId: config.message_id,
            });
          } else {
            logger.warn(`failed to collect ui-message from ${config.stream_id}.`);
          }
        });
        break;
      case 'codex-stream-json':
        ctx.after('webhook', async ({ logger }) => {
          const result = await collectMessage(
            config.message_id,
            decodeJsonLStream<ThreadEvent>(Readable.toWeb(ctx.streams.redis.createReadStream({ state, config })), true)
              .pipeThrough(createCodexTransform(config.message_id)),
          );

          if (result) {
            logger.info(`sending ui-message with`, result.state.message.parts.length, 'parts from stream', config.stream_id);
            await webhookCallback('stream-done', {
              message: result.state.message,
              streamId: config.stream_id,
              serverMessageId: config.message_id,
            });
          } else {
            logger.warn(`failed to collect ui-message from ${config.stream_id}.`);
          }
        });
        break;
      case 'pantheon-tdd-stream-json':
        ctx.after('webhook', async ({ logger }) => {
          const result = await collectMessage(
            config.message_id,
            decodeJsonLStream<StreamItem>(Readable.toWeb(ctx.streams.redis.createReadStream({ state, config })), true)
              .pipeThrough(createPantheonTddTransform(config.message_id)),
          );

          if (result) {
            logger.info(`sending ui-message with`, result.state.message.parts.length, 'parts from stream', config.stream_id);
            await webhookCallback('stream-done', {
              message: result.state.message,
              streamId: config.stream_id,
              serverMessageId: config.message_id,
            });
          } else {
            logger.warn(`failed to collect ui-message from ${config.stream_id}.`);
          }
        });
    }

    if (range !== false && range !== final_size - 1) {
      ctx.logger.error(`Final size does not match the state. range = ${range}, final_size = ${final_size}.`);
      ctx.status = 400;
      ctx.body = `Final size does not match the state. range = ${range}, final_size = ${final_size}.`;
      return;
    }
  } else {
    // Clear cache
    _cachedBR.delete(config.stream_id);

    switch (config.content_type) {
      case 'claude-code-stream-json+include-partial-messages':
        ctx.after('webhook', async ({ logger }) => {
          const result = await collectMessage(
            config.message_id,
            decodeJsonLStream<SDKMessage>(Readable.toWeb(ctx.streams.redis.createReadStream({ state, config })), false)
              .pipeThrough(createSDKMessageToUIMessageTransformStream(config.message_id)),
          );
          const message = result.state.message;
          logger.info(`sending ui-message with`, message?.parts.length, 'parts from stream', config.stream_id);
          await webhookCallback('stream-abort', {
            message,
            streamId: config.stream_id,
            serverMessageId: config.message_id,
          });
        });
        break;
      case 'codex-stream-json':
        ctx.after('webhook', async ({ logger }) => {
          const result = await collectMessage(
            config.message_id,
            decodeJsonLStream<ThreadEvent>(Readable.toWeb(ctx.streams.redis.createReadStream({ state, config })), false)
              .pipeThrough(createCodexTransform(config.message_id)),
          );
          const message = result.state.message;
          logger.info(`sending ui-message with`, message?.parts.length, 'parts from stream', config.stream_id);
          await webhookCallback('stream-abort', {
            message,
            streamId: config.stream_id,
            serverMessageId: config.message_id,
          });
        });
        break;
      case 'pantheon-tdd-stream-json':
        ctx.after('webhook', async ({ logger }) => {
          const result = await collectMessage(
            config.message_id,
            decodeJsonLStream<StreamItem>(Readable.toWeb(ctx.streams.redis.createReadStream({ state, config })), false)
              .pipeThrough(createPantheonTddTransform(config.message_id)),
          );
          const message = result.state.message;
          logger.info(`sending ui-message with`, message?.parts.length, 'parts from stream', config.stream_id);
          await webhookCallback('stream-abort', {
            message,
            streamId: config.stream_id,
            serverMessageId: config.message_id,
          });
        });
        break;
    }
  }

  ctx.after('backup', async () => {
    await ctx.streams.fs.save({ state, config }, ctx.streams.redis.createReadStream({ state, config }));
  });

  ctx.status = 200;
  ctx.body = {
    range,
  };
});

// Keepalive signal, prevent stream timeout
router.post('/v2/streams/:stream_id/actions/heartbeat', async (ctx) => {
  const stateKey = `v2:stream:${ctx.params.stream_id}:state`;

  const redis = await ctx.getRedis();

  await redis.watch(stateKey);
  const stateStr = await redis.get(stateKey);
  if (stateStr == null) {
    ctx.status = 404;
    return;
  }
  const state: StreamState = JSON.parse(stateStr);

  if (state.state !== 'streaming' && state.state !== 'pending') {
    ctx.status = 409;
    ctx.body = 'Stream is not in streaming or pending state.';
    return;
  }

  try {
    await redis
      .multi()
      .set(stateKey, JSON.stringify({
        ...state,
        timestamp: Date.now(),
      }))
      .exec();
  } catch (e) {
    // If the stream is already touched by another request, ignore the updates.
    if (e instanceof WatchError) {
      ctx.status = 204;
      return;
    }
    throw e;
  }
  ctx.status = 200;
});

// Delete a stream (for debug)
router.del('/v2/streams/:stream_id', async (ctx) => {
  await Promise.all([
    ctx.streams.fs.cleanup(ctx.params.stream_id),
    ctx.streams.redis.cleanup(ctx.params.stream_id),
  ]);

  ctx.status = 204;
});

// Subscribe to raw stream
//    ?format=vercel-ai-ui-message-stream-v1
router.get('/v2/streams/:stream_id/stream', async (ctx) => {
  const fsStreamInfo = await ctx.streams.fs.getStreamInfo(ctx.params.stream_id);

  let state: StreamState;
  let config: StreamConfig;

  const redis = await ctx.getRedis();

  if (fsStreamInfo) {
    state = fsStreamInfo.state;
    config = fsStreamInfo.config;
  } else {
    const configStr = await redis.get(`v2:stream:${ctx.params.stream_id}:config`);
    const stateStr = await redis.get(`v2:stream:${ctx.params.stream_id}:state`);
    if (configStr == null || stateStr == null) {
      ctx.status = 404;
      return;
    }
    config = JSON.parse(configStr);
    state = JSON.parse(stateStr);
  }

  ctx.res.statusCode = 200;
  ctx.set('Content-Type', 'text/event-stream');

  let target: Writable = ctx.res;
  const format = ctx.request.query.format;

  if (format === 'vercel-ai-ui-message-stream-v1') {
    let skip = 0;
    if (ctx.request.query.skip) {
      const skipStr = ctx.request.query.skip;
      if (typeof skipStr === 'string') {
        skip = parseInt(skipStr);
        if (isNaN(skip)) {
          skip = 0;
        }
      }
    }

    switch (config.content_type) {
      case 'claude-code-stream-json+include-partial-messages':
        ctx.status = 200;
        ctx.set(UI_MESSAGE_STREAM_HEADERS);
        if (skip > 0) {
          ctx.set('X-Stream-Skip-Applied', '1');
        }
        target = pipeWithClaudeCodeToVercelAISdkMessageTransformation(ctx, ctx.res, config.message_id, { skip });
        break;
      case 'codex-stream-json':
        ctx.status = 200;
        ctx.set(UI_MESSAGE_STREAM_HEADERS);
        if (skip > 0) {
          ctx.set('X-Stream-Skip-Applied', '1');
        }
        target = pipeWithCodexToVercelAISdkMessageTransformation(ctx, ctx.res, config.message_id, { skip });
        break;
      case 'pantheon-tdd-stream-json':
        ctx.status = 200;
        ctx.set(UI_MESSAGE_STREAM_HEADERS);
        if (skip > 0) {
          ctx.set('X-Stream-Skip-Applied', '1');
        }
        target = pipeWithPantheonTddToVercelAISdkMessageTransformation(ctx, ctx.res, config.message_id, { skip });
        break;
      default:
        ctx.status = 400;
        ctx.body = `Transform from ${config.content_type} to ${format} is not supported.`;
        return;
    }
  } else if (!format || format === 'opaque') {
    ctx.status = 200;
    ctx.set('Content-Type', 'application/octet-stream');
  } else {
    ctx.status = 409;
    ctx.body = `Invalid target format ${format}.`;
    return;
  }

  let input: Readable;

  if (fsStreamInfo) {
    input = ctx.streams.fs.createReadStream({ state, config });
  } else {
    input = await createRedisSubscribeStream(ctx.params.stream_id, config, redis, await ctx.getRedis('subscriber'));
  }

  await stream.promises.finished(input.pipe(target));
});

/**
 * This method will not check the stream state.
 */
async function* unsafeReadStream (redis: ReturnType<typeof getRedisClient>, ioChunkSize: number, streamId: string, offset: number, length: number) {
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

async function collectMessage<UI_MESSAGE extends UIMessage> (messageId: string, stream: ReadableStream<UIMessageChunk>, state?: StreamingUIMessageState<UI_MESSAGE>) {
  state = state ? structuredClone(state) : createStreamingUIMessageState<UI_MESSAGE>({ lastMessage: undefined, messageId });
  return await fastReadUIMessageStream({
    stream,
    state,
    messageId,
  });
}

function pipeWithClaudeCodeToVercelAISdkMessageTransformation (ctx: AfterContextHelpers, target: Writable, messageId: string, { skip = 0 }: { skip?: number } = {}) {
  const pipe = new PassThrough();

  const chunksStream = decodeJsonLStream<SDKMessage>(Readable.toWeb(pipe), false)
    .pipeThrough(createSDKMessageToUIMessageTransformStream(messageId))
    .pipeThrough(new SkipChunksStream(skip));

  const finishedPromise = stream.promises.finished(Readable.fromWeb(encodeVercelAIMessagesStream(chunksStream)).pipe(target));

  ctx.after(() => finishedPromise);

  return pipe;
}

function pipeWithCodexToVercelAISdkMessageTransformation (ctx: AfterContextHelpers, target: Writable, messageId: string, { skip = 0 }: { skip?: number } = {}) {
  const pipe = new PassThrough();

  const chunksStream = decodeJsonLStream<ThreadEvent>(Readable.toWeb(pipe), false)
    .pipeThrough(createCodexTransform(messageId))
    .pipeThrough(new SkipChunksStream(skip));

  const finishedPromise = stream.promises.finished(Readable.fromWeb(encodeVercelAIMessagesStream(chunksStream)).pipe(target));

  ctx.after(() => finishedPromise);

  return pipe;
}

function pipeWithPantheonTddToVercelAISdkMessageTransformation (ctx: AfterContextHelpers, target: Writable, messageId: string, { skip = 0 }: { skip?: number } = {}) {
  const pipe = new PassThrough();

  const chunksStream = decodeJsonLStream<StreamItem>(Readable.toWeb(pipe), false)
    .pipeThrough(createPantheonTddTransform(messageId))
    .pipeThrough(new SkipChunksStream(skip));

  const finishedPromise = stream.promises.finished(Readable.fromWeb(encodeVercelAIMessagesStream(chunksStream)).pipe(target));

  ctx.after(() => finishedPromise);

  return pipe;
}

class SkipChunksStream<T> extends TransformStream<T, T> {
  constructor (n: number) {
    let i = 0;
    super({
      transform (chunk, controller) {
        if (i < n) {
          i++;
        } else {
          controller.enqueue(chunk);
        }
      },
    });
  }
}

async function createRedisSubscribeStream (streamId: string, config: StreamConfig, redis: ReturnType<typeof getRedisClient>, subscriber: ReturnType<typeof getRedisClient>) {
  const pipe = new PassThrough();

  pipe.on('error', () => {
    ongoingProducer = undefined;
    shouldRunNext = false;
  });

  let ongoingProducer: Promise<void> | undefined = schedule();
  let shouldRunNext = false;
  let cursor = 0;

  async function schedule () {
    if (pipe.errored) {
      shouldRunNext = false;
      ongoingProducer = undefined;
      return;
    }

    const stateStr = await redis.get(`v2:stream:${streamId}:state`);
    if (!stateStr) {
      pipe.destroy(new Error('stream not found'));
      shouldRunNext = false;
      ongoingProducer = undefined;
      return;
    }

    const state: StreamState = JSON.parse(stateStr);
    const end = queryBoolSetRangeFrom(decodeBoolRange(Buffer.from(state.ranges, 'binary')), cursor);

    if (end !== false) {
      for await (const chunk of unsafeReadStream(redis, config.io_chunk_size, streamId, cursor, end - cursor + 1)) {
        await new Promise<void>((resolve, reject) => pipe.write(chunk, err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }));
      }
      cursor = end + 1;
    }

    if (state.state === 'done' || state.state === 'abort') {
      if (cursor === state.final_size) {
        pipe.end();
        shouldRunNext = false;
        ongoingProducer = undefined;
      } else {
        pipe.destroy(new Error(`Stream is not correctly finalized. (cursor=${cursor}, final_size=${state.final_size})`));
        shouldRunNext = false;
        ongoingProducer = undefined;
      }
    } else if (shouldRunNext) {
      ongoingProducer = schedule();
      shouldRunNext = false;
    } else {
      ongoingProducer = undefined;
    }
  }

  await subscriber.subscribe(`v2:stream:${streamId}:signal`, async () => {
    if (ongoingProducer) {
      shouldRunNext = true;
    } else {
      ongoingProducer = schedule();
    }
  });

  return pipe;
}
