import type { UIMessageChunk } from 'ai';
import { JsonEncodeStream, TextEventEncodeStream } from '../utils/stream-adapters.ts';

export function encodeVercelAIMessagesStream (readable: ReadableStream<UIMessageChunk>) {
  return readable
    .pipeThrough(new JsonEncodeStream())
    .pipeThrough(new TextEventEncodeStream(
      payload => ({ event: 'data', payload }),
      () => ({ event: 'data', payload: '[DONE]' }),
    ))
    .pipeThrough(new TextEncoderStream());
}
