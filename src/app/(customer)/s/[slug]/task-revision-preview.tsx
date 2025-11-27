"use client";

import { use, useEffect, useState } from "react";
import { PreviewIndexContext } from "@/app/(customer)/s/[slug]/preview-index-provider";
import type { UISessionData } from "@/app/(customer)/s/[slug]/query";
import { TaskRevisionPreviewClient } from "@/app/(customer)/s/[slug]/task-revision-preview-client";
import { handleFetchResponseError } from "@/lib/errors";

export function SessionTaskRevisionPreview({
  session,
}: {
  session: UISessionData;
}) {
  const { previewIndex } = use(PreviewIndexContext);

  const [url, setUrl] = useState<string | undefined>(undefined);

  const revisionStatus = session.task_revisions[previewIndex]?.status;
  const sandboxId = session.task_revisions[previewIndex]?.vercel_sandbox_id;

  useEffect(() => {
    setUrl(undefined);
  }, [previewIndex, revisionStatus]);

  useEffect(() => {
    if (revisionStatus === "interrupted") {
      return;
    }
    if (sandboxId) {
      const ac = new AbortController();
      fetch(
        `/api/v1/vercel-sandboxes/${sandboxId}/ports?projectId=${session.project_id}`,
        {
          signal: ac.signal,
        },
      )
        .then(handleFetchResponseError)
        .then((res) => res.json())
        .then((res) => setUrl(res[3000]));

      return () => {
        ac.abort();
      };
    }
  }, [session.project_id, sandboxId, revisionStatus]);

  return (
    <TaskRevisionPreviewClient
      key={`${previewIndex}-${revisionStatus}-${url}`}
      index={previewIndex}
      checkpoints={session.task_revisions.map((rev, index) => ({
        index,
        name: rev.user_prompt,
      }))}
      url={url ?? ""}
    />
  );
}
