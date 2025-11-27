"use client";

import { useQuery } from "@tanstack/react-query";
import type { UIDataTypes, UIMessagePart } from "ai";
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
import { CodexToolPart, type CodexTools } from "@/components/codex-tool-part";
import { useMessageSession } from "@/hooks/use-message-session";
import type { DB } from "@/lib/db/schema";
import { handleFetchResponseError } from "@/lib/errors";
import { generateSessionId } from "@/lib/tasks";

export function CodexMessageOverview({
  task_revision,
}: {
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
  const vercelSandboxCreated =
    vercelSandboxData?.status === "ready" ||
    vercelSandboxData?.status.startsWith("cmd:");

  const sessionId = generateSessionId(
    task_revision.project_id,
    task_revision.task_id,
    task_revision.id,
  );
  const { message, error, retry } = useMessageSession<CodexTools>(sessionId);

  useEffect(() => {
    if (!error || !branchCreated || !vercelSandboxCreated) return;

    const th = setTimeout(() => {
      retry();
    }, 1000);

    return () => {
      clearTimeout(th);
    };
  }, [error, branchCreated, vercelSandboxCreated]);

  const { todoListPart, lastReasoningPart, lastToolPart } = useMemo(() => {
    let todoListPart:
      | (UIMessagePart<UIDataTypes, CodexTools> & {
          type: "tool-todo_list";
          state: "output-available";
        })
      | undefined;
    let lastReasoningPart:
      | (UIMessagePart<any, any> & { type: "reasoning" })
      | undefined;
    let lastToolPart: any | undefined;
    if (message) {
      for (const part of message.parts) {
        console.log(part.type);
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
          lastToolPart = part;
        }
      }
    }
    return { todoListPart, lastReasoningPart, lastToolPart };
  }, [message]);

  return (
    <>
      <MessageContent>
        <Loader />
      </MessageContent>
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
                      <QueueItemIndicator completed={branchCreated} />
                      <QueueItemContent completed={branchCreated}>
                        Creating TiDB Cloud Branch
                      </QueueItemContent>
                    </div>
                  </QueueItem>
                  <QueueItem>
                    <div className="flex items-center gap-2">
                      <QueueItemIndicator completed={vercelSandboxCreated} />
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
                  {todoListPart.output.map((item) => (
                    <QueueItem key={item.text}>
                      <div className="flex items-center gap-2">
                        <QueueItemIndicator completed={item.completed} />
                        <QueueItemContent completed={item.completed}>
                          {item.text}
                        </QueueItemContent>
                      </div>
                    </QueueItem>
                  ))}
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
