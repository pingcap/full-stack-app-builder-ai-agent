"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  DynamicToolUIPart,
  ToolUIPart,
  UIDataTypes,
  UIMessage,
  UIMessagePart,
  UITools,
} from "ai";
import type { Selectable } from "kysely";
import { useEffect, useMemo } from "react";
import { Streamdown } from "streamdown";
import type { UISessionData } from "@/app/(customer)/s/[slug]/query";
import { Loader } from "@/components/ai-elements/loader";
import { MessageContent } from "@/components/ai-elements/message";
import {
  Queue,
  QueueItem,
  QueueItemContent,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "@/components/ai-elements/queue";
import {
  type ClaudeBuiltinToolPart,
  ClaudeTodoList,
  ClaudeToolPart,
} from "@/components/claude-tool-part";
import { CodexToolPart, type CodexTools } from "@/components/codex-tool-part";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMessageSession } from "@/hooks/use-message-session";
import type { DB } from "@/lib/db/schema";
import { getErrorMessage, handleFetchResponseError } from "@/lib/errors";
import { generateSessionId } from "@/lib/tasks";

export function MessageOverview({
  task_revision,
  coding_agent_type,
}: {
  coding_agent_type: string;
  task_revision: UISessionData["task_revisions"][number];
}) {
  const { data: branchData } = useQuery({
    enabled:
      task_revision.tidbcloud_branch_id !== null &&
      task_revision.status === "preparing",
    queryKey: ["tidbcloud_branches", task_revision.tidbcloud_branch_id],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/tidbcloud-branches/${task_revision.tidbcloud_branch_id}`,
        {
          method: "GET",
        },
      ).then(handleFetchResponseError);
      return response.json() as Promise<
        Omit<Selectable<DB["tidbcloud_branch"]>, "connection_url">
      >;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || !["ready", "failed"].includes(status)) {
        return 1000;
      }
      return false;
    },
  });

  const { data: vercelSandboxData } = useQuery({
    enabled:
      task_revision.vercel_sandbox_id !== null &&
      task_revision.status === "preparing",
    queryKey: ["vercel-sandboxes", task_revision.vercel_sandbox_id],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/vercel-sandboxes/${task_revision.vercel_sandbox_id}`,
        {
          method: "GET",
        },
      ).then(handleFetchResponseError);
      return response.json() as Promise<Selectable<DB["vercel_sandbox"]>>;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (
        !status ||
        status === "preparing" ||
        status.startsWith("setup:") ||
        status.startsWith("resume:")
      ) {
        return 1000;
      }
      return false;
    },
  });

  const branchCreated = branchData?.status === "ready";
  const vercelSandboxCreated = !!(
    vercelSandboxData?.status === "ready" ||
    vercelSandboxData?.status.startsWith("cmd:")
  );

  const sessionId = generateSessionId(
    task_revision.project_id,
    task_revision.task_id,
    task_revision.id,
  );
  const { message, error, retry } = useMessageSession<any>(sessionId);

  useEffect(() => {
    if (!error || !branchCreated || !vercelSandboxCreated) return;

    const th = setTimeout(() => {
      retry();
    }, 1000);

    return () => {
      clearTimeout(th);
    };
  }, [error, branchCreated, vercelSandboxCreated]);

  return (
    <>
      {task_revision.status === "running" && (
        <MessageContent>
          <div className="inline-flex items-center gap-2">
            <Loader />
          </div>
        </MessageContent>
      )}
      {task_revision.status === "interrupted" && (
        <Alert variant="destructive">
          <AlertTitle>Execution interrupted</AlertTitle>
          <AlertDescription>
            {getErrorMessage((message?.metadata as any)?.error) ??
              task_revision.error}
          </AlertDescription>
        </Alert>
      )}
      {coding_agent_type === "codex" && (
        <CodexOverviewContent
          task_revision={task_revision}
          branchCreated={branchCreated}
          vercelSandboxCreated={vercelSandboxCreated}
          message={message}
        />
      )}
      {/^claude(-opus)?/.test(coding_agent_type) && (
        <ClaudeOverviewContent
          task_revision={task_revision}
          branchCreated={branchCreated}
          vercelSandboxCreated={vercelSandboxCreated}
          message={message}
        />
      )}
    </>
  );
}

function QueueProgressIndicator({ completed }: { completed: boolean }) {
  return completed ? (
    <QueueItemIndicator completed />
  ) : (
    <Loader className="size-4" />
  );
}

function ExecutionPrepIndicator({
  status,
}: {
  status: "pending" | "in_progress" | "completed";
}) {
  if (status === "completed") {
    return <QueueItemIndicator completed />;
  }
  if (status === "in_progress") {
    return <Loader className="size-4" />;
  }
  return <QueueItemIndicator completed={false} />;
}

function CodexOverviewContent({
  task_revision,
  message,
  branchCreated,
  vercelSandboxCreated,
}: {
  task_revision: UISessionData["task_revisions"][number];
  branchCreated: boolean;
  vercelSandboxCreated: boolean;
  message: UIMessage<unknown, UIDataTypes, CodexTools> | undefined;
}) {
  const { todoListPart, lastReasoningPart, lastToolPart } = useMemo(() => {
    let todoListPart:
      | (UIMessagePart<UIDataTypes, CodexTools> & {
          type: "tool-todo_list";
          state: "output-available";
        })
      | undefined;
    let lastReasoningPart:
      | (UIMessagePart<UIDataTypes, CodexTools> & { type: "reasoning" })
      | undefined;
    let lastToolPart: ToolUIPart<CodexTools> | undefined;
    if (message) {
      for (const part of message.parts) {
        if (
          part.type === "tool-todo_list" &&
          part.state === "output-available"
        ) {
          todoListPart = part;
        }
        if (part.type === "reasoning") {
          lastReasoningPart = part;
          lastToolPart = undefined;
        }
        if (part.type.startsWith("tool-") && part.type !== "tool-todo_list") {
          lastToolPart = part as never;
        }
      }
    }
    return { todoListPart, lastReasoningPart, lastToolPart };
  }, [message]);

  return (
    <>
      {(task_revision.status === "preparing" || todoListPart) && (
        <Queue className="w-full">
          {task_revision.status === "preparing" && (
            <QueueSection className="w-full">
              <QueueSectionTrigger>
                <QueueSectionLabel label="Prepare execution environment">
                  Prepare execution environment
                </QueueSectionLabel>
              </QueueSectionTrigger>
              <QueueSectionContent>
                <QueueList>
                  <QueueItem>
                    <div className="flex items-center gap-2">
                      <QueueProgressIndicator completed={branchCreated} />
                      <QueueItemContent completed={branchCreated}>
                        Creating TiDB Cloud Branch
                      </QueueItemContent>
                    </div>
                  </QueueItem>
                  <QueueItem>
                    <div className="flex items-center gap-2">
                      <QueueProgressIndicator
                        completed={vercelSandboxCreated}
                      />
                      <QueueItemContent completed={vercelSandboxCreated}>
                        Creating Vercel Sandbox for coding agent execution
                      </QueueItemContent>
                    </div>
                  </QueueItem>
                </QueueList>
              </QueueSectionContent>
            </QueueSection>
          )}
          {todoListPart && (
            <QueueSection className="w-full">
              <QueueSectionTrigger>
                <QueueSectionLabel
                  label="tasks todo"
                  count={todoListPart.output.length}
                />
              </QueueSectionTrigger>
              <QueueSectionContent>
                <QueueList>
                  {(() => {
                    const firstIncompleteIndex = todoListPart.output.findIndex(
                      (item) => !item.completed,
                    );
                    return todoListPart.output.map((item, index) => {
                      const status = item.completed
                        ? "completed"
                        : index === firstIncompleteIndex
                          ? "in_progress"
                          : "pending";
                      return (
                        <QueueItem key={item.text}>
                          <div className="flex items-center gap-2">
                            <ExecutionPrepIndicator status={status} />
                            <QueueItemContent completed={item.completed}>
                              {item.text}
                            </QueueItemContent>
                          </div>
                        </QueueItem>
                      );
                    });
                  })()}
                </QueueList>
              </QueueSectionContent>
            </QueueSection>
          )}
        </Queue>
      )}

      {lastReasoningPart && (
        <MessageContent>
          <Streamdown className="text-sm text-muted-foreground">
            {lastReasoningPart.text}
          </Streamdown>
        </MessageContent>
      )}
      {lastToolPart && <CodexToolPart part={lastToolPart} />}
    </>
  );
}

function ClaudeOverviewContent({
  task_revision,
  message,
  branchCreated,
  vercelSandboxCreated,
}: {
  task_revision: UISessionData["task_revisions"][number];
  branchCreated: boolean;
  vercelSandboxCreated: boolean;
  message: UIMessage | undefined;
}) {
  const { todoListPart, lastReasoningOrTextPart, lastToolPart } =
    useMemo(() => {
      let todoListPart:
        | (ClaudeBuiltinToolPart<"TodoWrite"> & {
            state: "output-available";
          })
        | undefined;

      let lastReasoningOrTextPart:
        | (UIMessagePart<UIDataTypes, UITools> & { type: "reasoning" })
        | (UIMessagePart<UIDataTypes, UITools> & { type: "text" })
        | undefined;
      let lastToolPart: DynamicToolUIPart | undefined;
      if (message) {
        for (const part of message.parts) {
          if (
            part.type === "dynamic-tool" &&
            part.toolName === "TodoWrite" &&
            part.state === "output-available"
          ) {
            todoListPart = part as never;
            continue;
          }
          if (part.type === "reasoning" || part.type === "text") {
            lastReasoningOrTextPart = part;
            lastToolPart = undefined;
          }
          if (part.type === "dynamic-tool") {
            lastToolPart = part as never;
          }
        }
      }
      return { todoListPart, lastReasoningOrTextPart, lastToolPart };
    }, [message]);

  return (
    <>
      {(task_revision.status === "preparing" || todoListPart) && (
        <Queue className="w-full">
          {task_revision.status === "preparing" && (
            <QueueSection className="w-full">
              <QueueSectionTrigger>
                <QueueSectionLabel label="Prepare execution environment">
                  Prepare execution environment
                </QueueSectionLabel>
              </QueueSectionTrigger>
              <QueueSectionContent>
                <QueueList>
                  <QueueItem>
                    <div className="flex items-center gap-2">
                      <QueueProgressIndicator completed={branchCreated} />
                      <QueueItemContent completed={branchCreated}>
                        Creating TiDB Cloud Branch
                      </QueueItemContent>
                    </div>
                  </QueueItem>
                  <QueueItem>
                    <div className="flex items-center gap-2">
                      <QueueProgressIndicator
                        completed={vercelSandboxCreated}
                      />
                      <QueueItemContent completed={vercelSandboxCreated}>
                        Creating Vercel Sandbox for coding agent execution
                      </QueueItemContent>
                    </div>
                  </QueueItem>
                </QueueList>
              </QueueSectionContent>
            </QueueSection>
          )}
          {todoListPart && (
            <QueueSection className="w-full">
              <QueueSectionTrigger>
                <QueueSectionLabel
                  label="tasks todo"
                  count={todoListPart.input.todos.length}
                />
              </QueueSectionTrigger>
              <QueueSectionContent>
                <ClaudeTodoList todos={todoListPart.input.todos} />
              </QueueSectionContent>
            </QueueSection>
          )}
        </Queue>
      )}

      {lastReasoningOrTextPart?.type === "reasoning" && (
        <MessageContent>
          <Streamdown className="text-sm text-muted-foreground">
            {lastReasoningOrTextPart.text}
          </Streamdown>
        </MessageContent>
      )}

      {lastReasoningOrTextPart?.type === "text" && (
        <MessageContent>
          <Streamdown className="text-sm">
            {lastReasoningOrTextPart.text}
          </Streamdown>
        </MessageContent>
      )}

      {lastToolPart && <ClaudeToolPart part={lastToolPart} />}
    </>
  );
}
