"use client";

import { useQuery } from "@tanstack/react-query";
import { ReadyState } from "@vercel/sdk/models/createdeploymentop";
import type { GetDeploymentResponseBody } from "@vercel/sdk/models/getdeploymentop";
import { use, useEffect, useMemo, useState } from "react";
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

  const revision = session.task_revisions[previewIndex];

  const { data: deployment, isLoading: isDeploymentLoading } =
    useDeployment(revision);
  const { data: sandboxUrl, isLoading: isSandboxLoading } =
    useSandboxPortUrl(revision);

  const { errorTitle, errorMessage, url } = useMemo((): {
    errorTitle: string | undefined;
    errorMessage: string | undefined;
    url: string;
  } => {
    if (deployment) {
      switch (deployment.readyState) {
        case ReadyState.Canceled:
          return {
            errorTitle: "No deployment available.",
            errorMessage: "The preview environment deployment was canceled.",
            url: "",
          };
        case ReadyState.Error:
          return {
            errorTitle: "Failed to deploy.",
            errorMessage: `${deployment.errorCode}: ${deployment.errorMessage}.`,
            url: "",
          };
        case ReadyState.Ready:
          return {
            errorTitle: undefined,
            errorMessage: undefined,
            url: `https://${deployment.url}`,
          };
        case ReadyState.Building:
          return {
            errorTitle: "Deployment is not ready",
            errorMessage: "The deployment is still being built.",
            url: "",
          };
        case ReadyState.Initializing:
          return {
            errorTitle: "Deployment is not ready",
            errorMessage: "The deployment is still being initialized.",
            url: "",
          };
        case ReadyState.Queued:
          return {
            errorTitle: "Deployment is not ready",
            errorMessage: "The deployment is still queued.",
            url: "",
          };
      }
    } else if (sandboxUrl) {
      return {
        url: sandboxUrl,
        errorTitle: undefined,
        errorMessage: undefined,
      };
    } else if (isDeploymentLoading || revision?.vercel_deployment_id != null) {
      return {
        url: "",
        errorTitle: "Loading deployment status...",
        errorMessage: "Please wait for a while.",
      };
    } else if (isSandboxLoading || revision?.vercel_sandbox_id != null) {
      return {
        url: "",
        errorTitle: "Loading sandbox status...",
        errorMessage: "Please wait for a while.",
      };
    } else {
      return {
        url: "",
        errorTitle: "No preview or deployment available.",
        errorMessage: "No URL to preview.",
      };
    }
  }, [
    revision?.status,
    deployment?.readyState,
    deployment?.url,
    sandboxUrl,
    revision?.vercel_sandbox_id,
    isDeploymentLoading,
  ]);

  return (
    <TaskRevisionPreviewClient
      key={`${previewIndex}-${revision?.status}-${revision?.vercel_deployment_id ?? revision?.vercel_sandbox_id}-${url}`}
      index={previewIndex}
      checkpoints={session.task_revisions.map((rev, index) => ({
        index,
        name: rev.user_prompt,
      }))}
      url={url}
      error={
        errorTitle != null || errorMessage != null ? (
          <Alert>
            {errorTitle && <AlertTitle>{errorTitle}</AlertTitle>}
            {errorMessage && (
              <AlertDescription>{errorMessage}</AlertDescription>
            )}
          </Alert>
        ) : undefined
      }
    />
  );
}

function useDeployment(
  revision: UISessionData["task_revisions"][number] | undefined,
) {
  return useQuery({
    enabled: revision?.vercel_deployment_id != null,
    queryKey: ["revisions", revision?.id, "deployment"],
    queryFn: async () => {
      const deployment: GetDeploymentResponseBody = await fetch(
        `/api/v1/projects/${revision!.project_id}/tasks/${revision!.task_id}/revisions/${revision!.id}/deployment`,
      )
        .then(handleFetchResponseError)
        .then((res) => res.json());

      return deployment;
    },
    refetchInterval: (query) => {
      if (query.state.data) {
        if (
          ![ReadyState.Canceled, ReadyState.Error, ReadyState.Ready].includes(
            query.state.data.readyState as any,
          )
        ) {
          return 2500;
        }
      }
      return false;
    },
  });
}

function useSandboxPortUrl(
  revision: UISessionData["task_revisions"][number] | undefined,
) {
  return useQuery({
    enabled:
      revision?.vercel_sandbox_id != null &&
      revision?.vercel_deployment_id == null,
    queryKey: ["revisions", revision?.id, "sandbox-port-url", 3000],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/vercel-sandboxes/${revision!.vercel_sandbox_id}/ports?projectId=${revision!.project_id}`,
      )
        .then(handleFetchResponseError)
        .then((res) => res.json() as Promise<Record<number, string>>);

      return response[3000];
    },
  });
}
