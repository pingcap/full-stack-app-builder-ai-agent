import { z } from 'zod';

export type StreamConfig = z.infer<typeof streamConfigSchema>;
export type StreamState = z.infer<typeof streamStateSchema>;

export const streamConfigSchema = z.object({
  stream_id: z.string(),
  message_id: z.string(),
  content_type: z.enum([
    'opaque',
    'vercel-ai-ui-message',
    'vercel-ai-ui-message-stream-v1',
    'claude-code-stream-json+include-partial-messages',
    'codex-stream-json',
    'pantheon-tdd-stream-json',
  ]).optional().default('opaque'),
  io_chunk_size: z.number().int().min(4096).default(4096),
  // stream should time if no data or no chunks received. 0 means no timeout.
  write_timeout: z.number().int().min(0).default(60_000 /* ms */),
  gc_ttl: z.number().optional(),
}).loose();

const streamStateSchema = z.object({
  state: z.enum(['pending', 'streaming', 'done', 'abort']),
  stop_reason: z.string().optional(),
  final_size: z.number().int().min(0),
  ranges: z.string(), // encoded buffer state
  timestamp: z.number().int(),
});
