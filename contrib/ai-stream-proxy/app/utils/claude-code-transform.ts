import { type SDKAssistantMessage, type SDKCompactBoundaryMessage, type SDKMessage, type SDKPartialAssistantMessage, type SDKResultMessage, type SDKSystemMessage, type SDKUserMessage } from '@anthropic-ai/claude-code';
import { type BetaRawContentBlockStartEvent } from '@anthropic-ai/sdk/resources/beta';
import { type DynamicToolUIPart, type ToolUIPart, type UIMessageChunk, type UIMessagePart } from 'ai';

export function createSDKMessageToUIMessageTransformStream (id?: string) {
  const contentBlockCache: BetaRawContentBlockStartEvent['content_block'][] = [];

  const context: SDKMessageWithPartialToUIMessageChunksTransformContext = {
    contentBlockCache,
    textBlocks: 0,
    reasoningBlocks: 0,
  }

  return new TransformStream<SDKMessage, UIMessageChunk>({
    start (controller) {
      controller.enqueue({
        type: 'start',
        messageId: id,
      });
    },
    transform: (message, controller) => {
      sdkMessageWithPartialToUIMessageChunks(context, message).forEach(chunk => {
        controller.enqueue(chunk);
      });
    },
  });
}

export type SDKMessageWithPartialToUIMessageChunksTransformContext = {
  contentBlockCache: BetaRawContentBlockStartEvent['content_block'][];
  textBlocks: number;
  reasoningBlocks: number;
};

export function sdkMessageWithPartialToUIMessageChunks (
  context: SDKMessageWithPartialToUIMessageChunksTransformContext,
  message: SDKMessage,
): UIMessageChunk[] {
  let result: UIMessageChunk | (UIMessageChunk | undefined)[] | undefined;
  switch (message.type) {
    case 'system':
      result = transformSystemMessage(message);
      break;
    case 'user':
      result = transformUserMessage(message);
      break;
    case 'assistant':
      result = transformAssistantMessage(context, message);
      break;
    case 'stream_event':
      result = transformStreamEvent(context, message);
      break;
    case 'result':
      result = transformResultEvent(message);
      break;
  }

  if (result) {
    if (Array.isArray(result)) {
      return result.filter(Boolean) as UIMessageChunk[];
    } else {
      return [result];
    }
  } else {
    return [];
  }
}

function transformSystemMessage (message: SDKSystemMessage | SDKCompactBoundaryMessage): UIMessageChunk {
  switch (message.subtype) {
    case 'init':
      return {
        type: 'message-metadata',
        messageMetadata: {
          agent: 'claude-code',
          session_id: message.session_id,
          cwd: message.cwd,
          tools: message.tools,
          slash_commands: message.slash_commands,
          mcp_servers: message.mcp_servers,
          model: message.model,
          permission_mode: message.permissionMode,
        },
      };
    case 'compact_boundary':
      return {
        type: `data-compact_boundary`,
        data: message.compact_metadata,
        id: message.uuid,
      };
  }
}

function transformUserMessage (message: SDKUserMessage): (UIMessageChunk | undefined)[] | undefined {
  if (typeof message.message.content === 'string') {
    return undefined;
  }

  return message.message.content.map((content): UIMessageChunk | undefined => {
    switch (content.type) {
      case 'tool_result':
        if (content.is_error) {
          return {
            type: 'tool-output-error',
            errorText: typeof content.content === 'string' ? content.content : JSON.stringify(content.content, undefined, 2),
            toolCallId: content.tool_use_id,
            dynamic: true,
            providerExecuted: true,
          };
        } else {
          return {
            type: 'tool-output-available',
            output: content.content,
            toolCallId: content.tool_use_id,
            dynamic: true,
            providerExecuted: true,
          };
        }
    }
  });
}

function transformAssistantMessage (context: SDKMessageWithPartialToUIMessageChunksTransformContext, message: SDKAssistantMessage): (UIMessageChunk | undefined)[] {
  return message.message.content.flatMap((content): (UIMessageChunk | (UIMessageChunk | undefined)[]) | undefined => {
    switch (content.type) {
      case 'text':{
        const id = String(context.textBlocks++);
        return [
          { type: 'text-start', id, },
          { type: 'text-delta', delta: content.text, id, },
          { type: 'text-end', id, }
        ]
      }
      case 'thinking': {
        const id = String(context.reasoningBlocks++);
        return [
          { type: 'reasoning-start', id },
          { type: 'reasoning-delta', delta: content.thinking, id },
          { type: 'reasoning-end', id },
        ];
      }
      case 'tool_use':
        return {
          type: 'tool-input-available',
          toolName: content.name,
          toolCallId: content.id,
          input: content.input,
          dynamic: true,
          providerExecuted: true,
        };
      case 'mcp_tool_use':
        return {
          type: 'tool-input-available',
          toolName: content.name,
          toolCallId: content.id,
          input: content.input,
          dynamic: true,
          providerMetadata: {
            'claude-code': {
              server_name: content.server_name,
            },
          },
        };
      case 'server_tool_use':
        return {
          type: 'tool-input-available',
          toolName: content.name,
          toolCallId: content.id,
          input: content.input,
          dynamic: true,
        };
    }
  });
}

function transformStreamEvent (context: SDKMessageWithPartialToUIMessageChunksTransformContext, message: SDKPartialAssistantMessage): UIMessageChunk | undefined {
  switch (message.event.type) {
    case 'message_start':
      return { type: 'start-step' };
    case 'message_delta':
      return { type: 'data-delta', data: message.event.delta };
    case 'message_stop':
      return { type: 'finish-step' };
    case 'content_block_start': {
      const contentBlock = message.event.content_block;
      context.contentBlockCache[message.event.index] = message.event.content_block;

      switch (contentBlock.type) {
        case 'tool_use':
        case 'mcp_tool_use':
        case 'server_tool_use':
          return {
            type: 'tool-input-start',
            toolCallId: contentBlock.id,
            toolName: contentBlock.name,
            dynamic: true,
          };
      }
      break;
    }
    case 'content_block_stop': {
      const contentBlock = context.contentBlockCache[message.event.index];
      delete context.contentBlockCache[message.event.index];
      if (!contentBlock) {
        console.warn('No content block found for index', message.event.index);
        return undefined;
      }
      switch (contentBlock.type) {
        case 'tool_use':
        case 'mcp_tool_use':
        case 'server_tool_use':
          // tool input available returned by assistant tool_use call
          break;
      }
      break;
    }
    case 'content_block_delta': {
      const contentBlock = context.contentBlockCache[message.event.index];
      const contentBlockDelta = message.event.delta;
      if (!contentBlock) {
        console.warn('No content block found for index', message.event.index);
        return undefined;
      }

      switch (contentBlockDelta.type) {
        case 'input_json_delta':
          if (contentBlock.type !== 'tool_use' && contentBlock.type !== 'mcp_tool_use' && contentBlock.type !== 'server_tool_use') {
            console.warn('Received input_json_delta for non-tool_use content block', contentBlock);
            break;
          }
          return {
            type: 'tool-input-delta',
            toolCallId: contentBlock.id,
            inputTextDelta: contentBlockDelta.partial_json,
          };
      }
    }
  }
}

function transformResultEvent (message: SDKResultMessage): UIMessageChunk | UIMessageChunk[] | undefined {
  const metadata = {
    usage: message.usage,
    total_cost_usd: message.total_cost_usd,
    num_turns: message.num_turns,
    duration_ms: message.duration_ms,
    duration_api_ms: message.duration_api_ms,
  };
  switch (message.subtype) {
    case 'error_max_turns':
    case 'error_during_execution':
      return [
        {
          type: 'message-metadata',
          messageMetadata: metadata,
        },
        {
          type: 'message-metadata',
          messageMetadata: {
            error: message.subtype,
          },
        },
        {
          type: 'error',
          errorText: message.subtype,
        },
      ];
    case 'success':
      if (message.is_error) {
        return [
          {
            type: 'message-metadata',
            messageMetadata: message,
          },
          {
            type: 'message-metadata',
            messageMetadata: {
              error: message.result,
            },
          },
          {
            type: 'error',
            errorText: message.result,
          },
        ];
      } else {
        return [
          {
            type: 'message-metadata',
            messageMetadata: message,
          },
          {
            type: 'finish',
          },
        ];
      }
  }
}
