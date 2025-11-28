"use client";

import { use, useEffect, useState } from "react";
import { PreviewIndexContext } from "@/app/(customer)/s/[slug]/preview-index-provider";
import type { UISessionData } from "@/app/(customer)/s/[slug]/query";
import { TaskRevisionPreviewClient } from "@/app/(customer)/s/[slug]/task-revision-preview-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { handleFetchResponseError } from "@/lib/errors";

export function SessionTaskRevisionPreview({
  session,
}: {
  session: UISessionData;
}) {
  const { previewIndex } = use(PreviewIndexContext);

  const [url, setUrl] = useState<string | undefined>(undefined);
  const [errorTitle, setErrorTitle] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const revision = session.task_revisions[previewIndex];

  useEffect(() => {
    setUrl(undefined);
    setErrorTitle(undefined);
    setError(undefined);
  }, [previewIndex, revision?.status]);

  useEffect(() => {
    if (!revision || revision.status === "interrupted") {
      return;
    }
    const ac = new AbortController();

    if (revision.vercel_deployment_id) {
      fetch(
        `/api/v1/projects/${revision.project_id}/tasks/${revision.task_id}/revisions/${revision.id}/deployment`,
        {
          signal: ac.signal,
        },
      )
        .then(handleFetchResponseError)
        .then((res) => res.json())
        .then((deployment) => {
          let url = deployment.url;
          if (!/^https?:\/\//.test(url)) {
            url = `https://${url}`;
          }
          if (deployment.readyState === "ERROR") {
            setError(deployment.errorMessage);
            setErrorTitle(deployment.errorCode);
            setUrl("");
          } else {
            setUrl(url);
          }
        });
    } else if (revision.vercel_sandbox_id) {
      fetch(
        `/api/v1/vercel-sandboxes/${revision.vercel_sandbox_id}/ports?projectId=${session.project_id}`,
        {
          signal: ac.signal,
        },
      )
        .then(handleFetchResponseError)
        .then((res) => res.json())
        .then((res) => setUrl(res[3000]));
    }

    return () => {
      ac.abort();
    };
  }, [
    session.project_id,
    revision?.status,
    revision?.vercel_deployment_id,
    revision?.vercel_sandbox_id,
  ]);

  return (
    <TaskRevisionPreviewClient
      key={`${previewIndex}-${revision?.status}-${revision?.vercel_deployment_id ?? revision?.vercel_sandbox_id}-${url}`}
      index={previewIndex}
      checkpoints={session.task_revisions.map((rev, index) => ({
        index,
        name: rev.user_prompt,
      }))}
      url={url ?? ""}
      error={
        error != null ? (
          <Alert>
            {errorTitle && <AlertTitle>{errorTitle}</AlertTitle>}
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : undefined
      }
    />
  );
}
