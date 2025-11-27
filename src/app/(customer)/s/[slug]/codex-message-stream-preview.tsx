"use client";

import { CodexMessagePreview } from "@/app/(customer)/s/[slug]/codex-message-preview";
import type { UISessionData } from "@/app/(customer)/s/[slug]/query";
import type { CodexTools } from "@/components/codex-tool-part";
import { useMessageSession } from "@/hooks/use-message-session";
import { generateSessionId } from "@/lib/tasks";

export function CodexMessageStreamPreview({
  task_revision,
}: {
  task_revision: UISessionData["task_revisions"][number];
}) {
  const sessionId = generateSessionId(
    task_revision.project_id,
    task_revision.task_id,
    task_revision.id,
  );
  const { message, error } = useMessageSession<CodexTools>(sessionId);

  return <CodexMessagePreview message={message} />;
}
