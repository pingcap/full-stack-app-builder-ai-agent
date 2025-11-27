"use client";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { CodexToolPart } from "@/components/codex-tool-part";
import {
  isToolUIPart,
  parseJsonEventStream,
  readUIMessageStream,
  type UIMessage,
  uiMessageChunkSchema,
} from "ai";
import { use, useEffect, useRef, useState } from "react";

export default function DebugPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const session = use(params).sessionId;
  const requested = useRef(false);
  const [message, setMessage] = useState<UIMessage | undefined>(undefined);

  useEffect(() => {
    if (requested.current) return;

    requested.current = true;

    (async () => {
      for await (const message of collectStream(session)) {
        setMessage(message);
      }
    })();
  }, []);

  return (
    <Message from="assistant">
      <MessageContent>
        {message?.parts.map((part, index) => {
          switch (part.type) {
            case "text":
              return (
                <MessageResponse key={`${part.type}-${index}`}>
                  {part.text}
                </MessageResponse>
              );
            case "reasoning":
              return (
                <Reasoning key={`${part.type}-${index}`}>
                  <ReasoningTrigger />
                  <ReasoningContent>{part.text}</ReasoningContent>
                </Reasoning>
              );
            default:
              if (isToolUIPart(part)) {
                return (
                  <CodexToolPart
                    key={`${part.type}-${index}`}
                    part={part as never}
                  />
                );
              }
          }
        })}
      </MessageContent>
    </Message>
  );
}

async function* collectStream(session: string) {
  try {
    const response = await fetch(`/api/v1/debug/streams/${session}`);
    if (!response.ok) {
      return Promise.reject(
        Error(`Failed to fetch stream: ${response.statusText}`),
      );
    }

    const messageStream = readUIMessageStream({
      stream: parseJsonEventStream({
        stream: response.body!,
        schema: uiMessageChunkSchema,
      }).pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            if (chunk.success) {
              controller.enqueue(chunk.value);
            } else {
              console.error(
                "Error parsing stream chunk:",
                chunk.rawValue,
                chunk.error,
              );
            }
          },
        }),
      ),
    });

    for await (const message of messageStream) {
      yield message;
    }
  } catch (e) {
    console.error(e);
  }
}
