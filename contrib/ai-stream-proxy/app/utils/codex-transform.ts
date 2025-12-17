import type { ThreadEvent } from '@openai/codex-sdk';
import type { UIMessageChunk } from 'ai';

export function createCodexTransform (id?: string) {
  return new TransformStream<ThreadEvent, UIMessageChunk>({
    start (controller) {
      controller.enqueue({
        type: 'start',
        messageId: id,
      });
    },
    transform: (message, controller) => {
      const item = codexEventToUIChunk(message);
      if (item instanceof Array) {
        item.forEach(chunk => controller.enqueue(chunk));
      } else {
        controller.enqueue(item);
      }
    },
    flush (controller) {
      controller.enqueue({ type: 'finish' });
    },
  });
}

function codexEventToUIChunk (event: ThreadEvent): UIMessageChunk | UIMessageChunk[] {
  switch (event.type) {
    case 'thread.started':
      return {
        type: 'message-metadata',
        messageMetadata: {
          agent: 'codex',
          thread_id: event.thread_id,
        },
      };
    case 'turn.started':
      return {
        type: 'start-step',
      };
    case 'turn.completed':
    case 'turn.failed':
      return {
        type: 'finish-step',
      };
    case 'error':
      return {
        type: 'error',
        errorText: event.message,
      };
    case 'item.completed':
      switch (event.item.type) {
        case 'agent_message':
          return [
            { type: 'text-start', id: event.item.id },
            { type: 'text-delta', id: event.item.id, delta: event.item.text },
            { type: 'text-end', id: event.item.id },
          ];
        case 'reasoning':
          return [
            { type: 'reasoning-start', id: event.item.id },
            { type: 'reasoning-delta', id: event.item.id, delta: event.item.text },
            { type: 'reasoning-end', id: event.item.id },
          ];
        case 'todo_list':
          return {
            type: 'tool-output-available',
            toolCallId: event.item.id,
            output: event.item.items,
          };
        case 'web_search':
          return {
            type: 'tool-output-available',
            toolCallId: event.item.id,
            output: undefined,
          };
        case 'command_execution':
          switch (event.item.status) {
            case 'completed':
              return {
                type: 'tool-output-available',
                toolCallId: event.item.id,
                output: event.item.aggregated_output,
              };
            case 'failed':
              return {
                type: 'tool-output-error',
                toolCallId: event.item.id,
                errorText: event.item.aggregated_output,
              };
            default:
              return [];
          }
        case 'file_change':
          switch (event.item.status) {
            case 'completed':
              return [
                {
                  type: 'tool-input-available',
                  toolCallId: event.item.id,
                  toolName: 'file_change',
                  input: event.item.changes,
                },
                {
                  type: 'tool-output-available',
                  toolCallId: event.item.id,
                  output: event.item.status,
                },
              ];
            case 'failed':
              return [
                {
                  type: 'tool-input-available',
                  toolCallId: event.item.id,
                  toolName: 'file_change',
                  input: event.item.changes,
                },
                {
                  type: 'tool-output-error',
                  toolCallId: event.item.id,
                  errorText: event.item.status,
                },
              ];
            default:
              return [];
          }
        case 'mcp_tool_call': {
          switch (event.item.status) {
            case 'completed':
              return {
                type: 'tool-output-available',
                toolCallId: event.item.id,
                output: event.item.result,
                dynamic: true,
              };
            case 'failed':
              return {
                type: 'tool-output-error',
                toolCallId: event.item.id,
                errorText: event.item.error?.message ?? 'No message',
                dynamic: true,
              };
            default:
              return [];
          }
        }
        case 'error':
          return [];
        default:
          return [];
      }
    case 'item.started':
      switch (event.item.type) {
        case 'error':
        case 'agent_message':
        case 'reasoning':
        case 'file_change':
          return [];
        case 'command_execution':
          return {
            type: 'tool-input-available',
            toolCallId: event.item.id,
            toolName: 'command_execution',
            input: event.item.command,
          };
        case 'mcp_tool_call':
          return {
            type: 'tool-input-available',
            toolName: `mcp__${event.item.server}__${event.item.tool}`,
            toolCallId: event.item.id,
            dynamic: true,
            input: event.item.arguments,
          };
        case 'web_search':
          return {
            type: 'tool-input-available',
            toolName: 'web_search',
            toolCallId: event.item.id,
            input: event.item.query,
          };
        case 'todo_list':
          return [
            {
              type: 'tool-input-available',
              toolName: 'todo_list',
              toolCallId: event.item.id,
              input: event.item.items,
            },
            {
              type: 'tool-output-available',
              toolCallId: event.item.id,
              output: event.item.items,
            },
          ];
        default:
          return [];
      }
    case 'item.updated':
      switch (event.item.type) {
        case 'todo_list':
          return {
            type: 'tool-output-available',
            toolCallId: event.item.id,
            output: event.item.items,
          };
        default:
          return [];
      }
  }

  return [];
}