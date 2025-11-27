"use client";

import { MessagePreview } from "@/app/(customer)/s/[slug]/message-preview";
import type { UISessionData } from "@/app/(customer)/s/[slug]/query";
import type { CodexTools } from "@/components/codex-tool-part";
import { useMessageSession } from "@/hooks/use-message-session";
import { generateSessionId } from "@/lib/tasks";

export function MessageStreamPreview({
  task_revision,
  coding_agent_type,
}: {
  coding_agent_type: string;
  task_revision: UISessionData["task_revisions"][number];
}) {
  const sessionId = generateSessionId(
    task_revision.project_id,
    task_revision.task_id,
    task_revision.id,
  );
  const { message } = useMessageSession(sessionId);

  return (
    <MessagePreview message={message} coding_agent_type={coding_agent_type} />
  );
}
