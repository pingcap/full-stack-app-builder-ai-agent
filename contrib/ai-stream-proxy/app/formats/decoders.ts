import type { SDKMessage } from '@anthropic-ai/claude-code';
import type { UIMessageChunk } from 'ai';
import {  } from '@ai-sdk/openai'
import { BufferedLinesStream, JsonDecoderStream, ReplaceInvalidSequencesStream, type TextEvent, TextEventDecodeStream } from '../utils/stream-adapters.ts';

export function decodeJsonLStream<T> (readable: ReadableStream<Buffer>, completed: boolean, {
  onJsonDecodeChunkError,
  onJsonDecodeReportNotEscapedControlCharacters,
}: {
  onJsonDecodeChunkError?: (err: unknown, chunk: string) => void,
  onJsonDecodeReportNotEscapedControlCharacters?: (code: number) => void,
} = {}) {
  return readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new BufferedLinesStream('\n'))
    .pipeThrough(new ReplaceInvalidSequencesStream())
    .pipeThrough<T>(new JsonDecoderStream('', {
      onChunkError: onJsonDecodeChunkError,
      onReportNotEscapedControlCharacters: onJsonDecodeReportNotEscapedControlCharacters,
    }));
}

export function decodeVercelAIMessagesStream (readable: ReadableStream<Buffer>) {
  return readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new BufferedLinesStream('\n\n'))
    .pipeThrough(new TextEventDecodeStream())
    .pipeThrough(new TransformStream<TextEvent, UIMessageChunk>({
      transform (chunk, controller) {
        if (chunk.event === 'data') {
          if (chunk.payload !== '[DONE]') {
            controller.enqueue(JSON.parse(chunk.event) as UIMessageChunk);
          }
        }
      },
    }));
}


