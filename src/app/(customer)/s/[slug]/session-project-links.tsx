import { Vercel } from "@vercel/sdk";
import {
  getProject,
  type UISessionData,
} from "@/app/(customer)/s/[slug]/query";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSessionUserSettings } from "@/lib/auth";

export async function SessionProjectLinks({
  session,
}: {
  session: UISessionData;
}) {
  const settings = await getSessionUserSettings();
  const project = await getProject(session.project_id);
  if (!project) {
    return null;
  }

  const sdk = new Vercel({
    bearerToken: project.vercel_team_token,
  });

  const { slug: teamSlug } = await sdk.teams.getTeam({
    teamId: project.vercel_team_id,
  });

  const { name: projectName } = await fetch(
    `https://api.vercel.com/v1/projects/${project.vercel_project_id}?teamId=${project.vercel_team_id}`,
    {
      headers: {
        Authorization: `Bearer ${project.vercel_team_token}`,
      },
    },
  ).then((res) => {
    if (!res.ok) {
      throw new Error("Failed to fetch vercel project info");
    }
    return res.json();
  });

  return (
    <TooltipProvider>
      <div className="ml-auto flex items-center gap-2 text-xs py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={`https://github.com/${project.github_owner}/${project.github_repo}`}
              target="_blank"
            >
              <svg
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="size-4"
                fill="#181717"
              >
                <title>GitHub</title>
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>
          </TooltipTrigger>
          <TooltipContent>Linked GitHub Repository</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={`https://vercel.com/${teamSlug}/${projectName}`}
              target="_blank"
            >
              <svg
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="size-4"
                fill="#000000"
              >
                <title>Vercel</title>
                <path d="m12 1.608 12 20.784H0Z" />
              </svg>
            </a>
          </TooltipTrigger>
          <TooltipContent>Linked Vercel Project</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={`https://tidbcloud.com/clusters/${project.tidbcloud_cluster_id}/overview?orgId=${settings?.tidbcloud_organization_id}&projectId=${settings?.tidbcloud_project_id}`}
              target="_blank"
            >
              <svg
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="-16.71 0 249.42 249.42"
                className="size-4"
              >
                <title>TiDB</title>
                <defs>
                  <style>{`.cls-1{fill:#e30c34;}.cls-2{fill:#fff;}`}</style>
                </defs>
                <g>
                  <g>
                    <polygon
                      className="cls-1"
                      points="0 62.35 0 187.06 108 249.41 216 187.06 216 62.35 108 0 0 62.35"
                    />
                    <polygon
                      className="cls-2"
                      points="107.94 41.63 36.21 83.04 36.21 124.45 72.08 103.73 72.08 187.11 107.94 207.78 107.94 207.78 107.94 83.03 143.79 62.33 107.94 41.63"
                    />
                    <polygon
                      className="cls-2"
                      points="144 103.95 144 187.06 180 166.28 180 83.14 144 103.95"
                    />
                  </g>
                </g>
              </svg>
            </a>
          </TooltipTrigger>
          <TooltipContent>Linked TiDB Cloud Cluster</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
