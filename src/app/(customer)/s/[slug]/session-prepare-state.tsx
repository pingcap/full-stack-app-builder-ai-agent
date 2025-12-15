"use client";

import { convertArrayToReadableStream } from "@ai-sdk/provider-utils/test";
import { readUIMessageStream, type ToolUIPart } from "ai";
import { AlertCircleIcon, CheckIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import type { UISessionData } from "@/app/(customer)/s/[slug]/query";
import { Loader } from "@/components/ai-elements/loader";
import {
  Queue,
  QueueItemContent,
  QueueItemDescription,
} from "@/components/ai-elements/queue";
import type {
  UISessionMessage,
  UISessionMessageChunk,
  UISessionMessageTools,
} from "@/prompts/ui-session";

const defaultMessage = (id: number): UISessionMessage => ({
  id: `ui-message:${id}`,
  role: "assistant",
  parts: [],
});

export function SessionPrepareState({ session }: { session: UISessionData }) {
  const [message, setMessage] = useState<UISessionMessage>(() =>
    defaultMessage(session.id),
  );
  useEffect(() => {
    if (session.message) {
      setMessage(session.message as never);
      return;
    }

    const reader = readUIMessageStream<UISessionMessage>({
      stream: convertArrayToReadableStream<UISessionMessageChunk>(
        Array.isArray(session.logs) ? (session.logs as never) : [],
      ),
      message: defaultMessage(session.id),
    });

    const readerTask = (async () => {
      try {
        let lastMessage = defaultMessage(session.id);
        for await (const message of reader) {
          lastMessage = message;
        }

        setMessage(lastMessage);
      } catch (_e) {}
    })();

    return () => {
      readerTask.catch(() => {
        reader.cancel().catch(() => {});
      });
    };
  }, [session]);

  if (session.message) {
    return null;
  }

  return (
    <Queue>
      <ul>
        {message.parts.map((part) => {
          switch (part.type) {
            case "tool-create-github-repo":
              return (
                <TodoItem key={part.toolCallId} part={part}>
                  Create GitHub Repository{" "}
                  {`${part.input?.owner}/${part.input?.name}`}
                </TodoItem>
              );
            case "tool-create-tidbcloud-cluster":
              return (
                <TodoItem key={part.toolCallId} part={part}>
                  Create TiDBCloud cluster {part.input?.tidbcloud_cluster_name}
                </TodoItem>
              );
            case "tool-create-vercel-project":
              return (
                <TodoItem key={part.toolCallId} part={part}>
                  Create Vercel project {part.input?.vercel_project_name}
                </TodoItem>
              );
            case "tool-generate-first-prompt":
              return (
                <TodoItem key={part.toolCallId} part={part}>
                  Detect user intent
                </TodoItem>
              );
            case "tool-detect-user-intent":
              return (
                <TodoItem key={part.toolCallId} part={part}>
                  Detect user intent
                </TodoItem>
              );
            case "tool-generate-meta-fields":
              return (
                <TodoItem key={part.toolCallId} part={part}>
                  Generate project info
                </TodoItem>
              );
            default:
              return null;
          }
        })}
      </ul>
    </Queue>
  );
}

function TodoItem({
  part,
  children,
}: {
  part: ToolUIPart<UISessionMessageTools>;
  children: ReactNode;
}) {
  const completed = part.state === "output-available";
  const error = part.state === "output-error" ? part.errorText : undefined;

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <AlertCircleIcon className="text-destructive size-4" />
      ) : completed ? (
        <CheckIcon className="text-green-500 size-4" />
      ) : (
        <Loader className="size-4" />
      )}
      <QueueItemContent className="text-sm" completed={completed}>
        {children}
      </QueueItemContent>
      {error && <QueueItemDescription>{error}</QueueItemDescription>}
    </div>
  );
}
