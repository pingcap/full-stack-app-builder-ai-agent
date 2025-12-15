"use client";

import { useQuery } from "@tanstack/react-query";
import { ReadyState } from "@vercel/sdk/models/createdeploymentop";
import type { GetDeploymentEventsResponseBodyDeployments2 } from "@vercel/sdk/models/getdeploymenteventsop";
import type { GetDeploymentResponseBody } from "@vercel/sdk/models/getdeploymentop";
import type { ChatStatus } from "ai";
import { strip } from "ansicolor";
import chalk from "chalk";
import { AlertCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useMemo, useTransition } from "react";
import { PreviewIndexContext } from "@/app/(customer)/s/[slug]/preview-index-provider";
import type { UISessionData } from "@/app/(customer)/s/[slug]/query";
import { TaskRevisionPreviewClient } from "@/app/(customer)/s/[slug]/task-revision-preview-client";
import { AnsiLogs } from "@/components/ansi-logs";
import { Button } from "@/components/ui/button";
import { handleFetchResponseError } from "@/lib/errors";

export function SessionTaskRevisionPreview({
  chatStatus,
  session,
}: {
  chatStatus: ChatStatus;
  session: UISessionData;
}) {
  const { previewIndex } = use(PreviewIndexContext);
  const router = useRouter();
  const [transitioning, startTransition] = useTransition();

  const revision = session.task_revisions[previewIndex];

  const { data: deployment, isLoading: isDeploymentLoading } =
    useDeployment(revision);
  const { data: sandboxUrl, isLoading: isSandboxLoading } =
    useSandboxPortUrl(revision);

  const { errorTitle, errorMessage, url, isLoadingPlaceholder } = useMemo((): {
    errorTitle: string | undefined;
    errorMessage: string | undefined;
    url: string;
    isLoadingPlaceholder: boolean;
  } => {
    if (deployment) {
      switch (deployment.readyState) {
        case ReadyState.Canceled:
          return {
            errorTitle: "No deployment available.",
            errorMessage: "The preview environment deployment was canceled.",
            url: "",
            isLoadingPlaceholder: false,
          };
        case ReadyState.Error:
          return {
            errorTitle: "Failed to deploy.",
            errorMessage: `${deployment.errorCode}: ${deployment.errorMessage}.`,
            url: "",
            isLoadingPlaceholder: false,
          };
        case ReadyState.Ready:
          return {
            errorTitle: undefined,
            errorMessage: undefined,
            url: `https://${deployment.url}`,
            isLoadingPlaceholder: false,
          };
        case ReadyState.Building:
          return {
            errorTitle: "Deployment is not ready",
            errorMessage: "The deployment is still being built.",
            url: "",
            isLoadingPlaceholder: true,
          };
        case ReadyState.Initializing:
          return {
            errorTitle: "Deployment is not ready",
            errorMessage: "The deployment is still being initialized.",
            url: "",
            isLoadingPlaceholder: true,
          };
        case ReadyState.Queued:
          return {
            errorTitle: "Deployment is not ready",
            errorMessage: "The deployment is still queued.",
            url: "",
            isLoadingPlaceholder: true,
          };
      }
    } else if (sandboxUrl) {
      return {
        url: sandboxUrl,
        errorTitle: undefined,
        errorMessage: undefined,
        isLoadingPlaceholder: false,
      };
    } else if (isDeploymentLoading || revision?.vercel_deployment_id != null) {
      return {
        url: "",
        errorTitle: "Loading deployment status...",
        errorMessage: "Please wait for a while.",
        isLoadingPlaceholder: true,
      };
    } else if (isSandboxLoading || revision?.vercel_sandbox_id != null) {
      return {
        url: "",
        errorTitle: "Loading sandbox status...",
        errorMessage: "Please wait for a while.",
        isLoadingPlaceholder: true,
      };
    } else {
      return {
        url: "",
        errorTitle: "No preview or deployment available.",
        errorMessage: "No URL to preview.",
        isLoadingPlaceholder: false,
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

  const deploymentLog = useMemo(() => {
    return (
      deployment?.events
        ?.map((event) => {
          const line = `${event.text || ""}\r\n`;
          if (event.level === "warning") {
            return chalk(`${chalk.yellow.bold("[WARN ]")} ${line}`);
          } else if (event.level === "error") {
            return chalk(`${chalk.red.bold("[ERROR]")} ${line}`);
          }
          if (event.type === "stderr") {
            return line;
          } else if (event.type === "stdout") {
            return chalk.dim(line);
          }
          return line;
        })
        .join("") ?? ""
    );
  }, [deployment?.events]);

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
        errorTitle != null ||
        errorMessage != null ||
        deploymentLog.length > 0 ? (
          <>
            {(errorTitle != null || errorMessage != null) &&
            (isLoadingPlaceholder ||
              errorTitle === "No preview or deployment available.") ? (
              <div className="text-sm text-muted-foreground">
                {errorTitle && <div>{errorTitle}</div>}
                {errorMessage && <div>{errorMessage}</div>}
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <AlertCircleIcon className="mt-0.5 h-4 w-4" />
                  <div className="space-y-1">
                    {errorTitle && (
                      <div className="font-medium text-foreground">
                        {errorTitle}
                      </div>
                    )}
                    {errorMessage && <div>{errorMessage}</div>}
                  </div>
                </div>
                {deploymentLog.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {previewIndex === session.task_revisions.length - 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={transitioning || chatStatus !== "ready"}
                        onClick={() => {
                          startTransition(async () => {
                            if (!deployment?.events) {
                              return;
                            }
                            const buildLogIndex = deployment.events.findIndex(
                              (event) =>
                                event.text === 'Running "npm run build"',
                            );
                            const logs = deployment.events
                              .slice(buildLogIndex === -1 ? 0 : buildLogIndex)
                              .map((log) => `${strip(log.text ?? "")}\n`)
                              .join("")
                              .replaceAll(/```/g, "\\`\\`\\`");
                            const message = `Build errors found in the vercel deployment:
\`\`\`\n${logs}\n\`\`\`

Help me to fix the bugs.
`;
                            if (!session.task_id || !session.project_id) {
                              return;
                            }
                            await fetch(
                              `/api/v1/projects/${session.project_id}/tasks/${session.task_id}/revisions`,
                              {
                                method: "POST",
                                body: JSON.stringify({
                                  prompt: message,
                                }),
                              },
                            ).then(handleFetchResponseError);
                            startTransition(() => {
                              router.refresh();
                            });
                          });
                        }}
                      >
                        Fix build errors
                      </Button>
                    )}
                    {deployment && (
                      <Button variant="link" size="sm" asChild>
                        <a
                          href={`https://vercel.com/${deployment.team?.slug}/${deployment.project?.name}/${deployment.id}`}
                          target="_blank"
                        >
                          Visit Vercel Deployment
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
            {deploymentLog.length > 0 && (
              <div className="flex-1 w-full overflow-hidden">
                <div className="size-full overflow-y-scroll overflow-x-scroll p-4 border rounded-lg">
                  <AnsiLogs raw={deploymentLog} />
                </div>
              </div>
            )}
          </>
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
      const deployment: GetDeploymentResponseBody & {
        events?: GetDeploymentEventsResponseBodyDeployments2[];
      } = await fetch(
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
