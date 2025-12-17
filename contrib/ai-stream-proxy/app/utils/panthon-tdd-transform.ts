import type { UIMessageChunk } from 'ai';
import type { StreamItem } from 'pantheon-tdd-sdk/stream-items';

export function createPantheonTddTransform (id?: string) {
  return new TransformStream<StreamItem, UIMessageChunk>({
    start (controller) {
      controller.enqueue({
        type: 'start',
        messageId: id,
      });
    },
    transform: (message, controller) => {
      const item = pantheonStreamItemToUIChunk(message);
      if (item instanceof Array) {
        item.forEach(chunk => controller.enqueue(chunk));
      } else {
        controller.enqueue(item);
      }
    },
  });
}

function pantheonStreamItemToUIChunk (event: StreamItem): UIMessageChunk | UIMessageChunk[] {
  switch (event.type) {
    case 'thread.started': {
      const { type, headless, ...rest } = event;
      return {
        type: 'message-metadata',
        messageMetadata: {
          agent: 'pantheon-tdd',
          ...rest,
        },
      };
    }
    case 'turn.started':
      return {
        type: 'start-step',
      };
    case 'turn.completed':
      return {
        type: 'finish-step',
      };
    case 'item.completed':
      return {
        type: 'tool-output-available',
        toolCallId: event.item_id,
        output: {
          branch_id: event.branch_id,
          status: event.status,
          summary: event.summary,
          duration_ms: event.duration_ms,
        },
      };
    case 'item.started':
      return {
        type: 'tool-input-available',
        toolCallId: event.item_id,
        toolName: event.name,
        input: event.args,
      };
    case 'assistant.message':
      return [{
        type: 'text-start',
        id: `${event.thread_id}/${event.sequence}`,
      }, {
        type: 'text-delta',
        delta: event.preview,
        id: `${event.thread_id}/${event.sequence}`,
      }, {
        type: 'text-end',
        id: `${event.thread_id}/${event.sequence}`,
      }];
    case 'thread.completed':
      if (event.status === 'error') {
        return {
          type: 'error',
          errorText: event.summary,
        };
      } else {
        return [
          {
            type: 'text-start',
            id: `${event.thread_id}/${event.sequence}`,
          },
          {
            type: 'text-delta',
            delta: `${event.summary}\n\n`,
            id: `${event.thread_id}/${event.sequence}`,
          },
          {
            type: 'text-delta',
            delta: `Final Report:\n\n\`\`\`\njson${JSON.stringify(event.final_report, undefined, 2)}\n\`\`\`\n`,
            id: `${event.thread_id}/${event.sequence}`,
          }, {
            type: 'text-end',
            id: `${event.thread_id}/${event.sequence}`,
          },
          {
            type: 'finish',
          },
        ];
      }
  }

  return [];
}