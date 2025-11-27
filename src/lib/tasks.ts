import { createHash } from "node:crypto";

export function generateSessionId(
  projectId: number,
  taskId: number,
  revisionId: number,
) {
  return createHash("md5")
    .update(`projects/${projectId}/tasks/${taskId}/revisions/${revisionId}`)
    .digest("hex");
}
