import type { UIMessage } from 'ai';
import env from './env.ts';

export async function webhookCallback (event: 'stream-done', data: { streamId: string, serverMessageId?: string, message: UIMessage }): Promise<void>
export async function webhookCallback (event: 'stream-abort', data: { streamId: string, serverMessageId?: string, message: UIMessage }): Promise<void>
export async function webhookCallback (event: string, data: any): Promise<void> {
  if (env.WEBHOOK_URLS) {
    await Promise.all(env.WEBHOOK_URLS.map(async (url) => {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event,
          data,
        }),
      }).then(res => {
        if (!res.ok) {
          return Promise.reject(`${res.status}`);
        }
      });
    }));
  }
}