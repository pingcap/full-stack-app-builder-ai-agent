import { Vercel } from "@vercel/sdk";
import { ChevronDown } from "lucide-react";
import type { ReactElement, ReactNode, SVGProps } from "react";
import {
  getProject,
  type UISessionData,
} from "@/app/(customer)/s/[slug]/query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSiteSettings } from "@/lib/system-settings";
import { listBranches } from "@/lib/tidbcloud/sdk";
import { isTiDBCloudSettingsValid } from "@/lib/user-settings/tidbcloud";

const GithubIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const VercelIconSvg = (props: SVGProps<SVGSVGElement>) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <path d="m12 1.608 12 20.784H0Z" />
  </svg>
);

const TiDBIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="-16.71 0 249.42 249.42"
    aria-hidden="true"
    {...props}
  >
    <g>
      <g>
        <polygon
          fill="#e30c34"
          points="0 62.35 0 187.06 108 249.41 216 187.06 216 62.35 108 0 0 62.35"
        />
        <polygon
          fill="#fff"
          points="107.94 41.63 36.21 83.04 36.21 124.45 72.08 103.73 72.08 187.11 107.94 207.78 107.94 207.78 107.94 83.03 143.79 62.33 107.94 41.63"
        />
        <polygon
          fill="#fff"
          points="144 103.95 144 187.06 180 166.28 180 83.14 144 103.95"
        />
      </g>
    </g>
  </svg>
);

export async function SessionProjectLinks({
  session,
}: {
  session: UISessionData;
}) {
  const settings = await getSiteSettings();

  const project = session.project_id
    ? await getProject(session.project_id)
    : null;
  if (!project) {
    return null;
  }

  const githubHref = `https://github.com/${project.github_owner}/${project.github_repo}`;
  const github = (
    <Tooltip>
      <TooltipTrigger asChild>
        <a href={githubHref} target="_blank">
          <GithubIcon className="size-4" fill="#181717" />
        </a>
      </TooltipTrigger>
      <TooltipContent>Linked GitHub Repository</TooltipContent>
    </Tooltip>
  );

  const branchName =
    session.task?.git_branch_name && session.task.git_branch_name.length
      ? session.task.git_branch_name
      : "main";
  const githubBranches = [
    {
      branch: branchName,
      commits: session.task_revisions
        .map((rev) =>
          rev.git_commit_sha
            ? {
                sha: rev.git_commit_sha,
                message:
                  rev.user_prompt ??
                  rev.prompt ??
                  rev.git_commit_sha.slice(0, 7),
                url: `https://github.com/${project.github_owner}/${project.github_repo}/commit/${rev.git_commit_sha}`,
              }
            : null,
        )
        .filter((c): c is { sha: string; message: string; url: string } =>
          Boolean(c),
        ),
    },
  ];

  let vercelMeta:
    | {
        teamSlug: string;
        projectName: string;
      }
    | undefined;
  let vercel: ReactElement | undefined;

  try {
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

    vercelMeta = { teamSlug, projectName };

    vercel = (
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={`https://vercel.com/${teamSlug}/${projectName}`}
            target="_blank"
          >
            <VercelIconSvg className="size-4" fill="#000000" />
          </a>
        </TooltipTrigger>
        <TooltipContent>Linked Vercel Project</TooltipContent>
      </Tooltip>
    );
  } catch {}

  const tidbHref = `https://tidbcloud.com/clusters/${project.tidbcloud_cluster_id}/overview?orgId=${settings?.tidbcloud_organization_id}&projectId=${settings?.tidbcloud_project_id}`;
  const tidbcloud = (
    <Tooltip>
      <TooltipTrigger asChild>
        <a href={tidbHref} target="_blank">
          <TiDBIcon className="size-4" />
        </a>
      </TooltipTrigger>
      <TooltipContent>Linked TiDB Cloud Cluster</TooltipContent>
    </Tooltip>
  );

  let tidbBranches:
    | {
        branchId: string;
        displayName?: string;
        state?: string;
      }[]
    | undefined;

  if (
    project.tidbcloud_cluster_id &&
    settings &&
    isTiDBCloudSettingsValid(settings)
  ) {
    try {
      const branches = await listBranches(
        project.tidbcloud_cluster_id,
        settings,
      );
      tidbBranches = branches.map((branch) => ({
        branchId: branch.branchId,
        displayName: branch.displayName,
        state: branch.state,
      }));
    } catch {
      tidbBranches = undefined;
    }
  }

  return (
    <TooltipProvider>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="ml-auto flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <div className="flex items-center gap-2">
              {github}
              {vercel}
              {tidbcloud}
            </div>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-96 max-w-[90vw] overflow-hidden p-0"
          align="end"
        >
          <div className="space-y-4 p-4 text-sm overflow-auto max-h-[70vh]">
            <ResourceDetail
              title="GitHub Repository"
              value={`${project.github_owner}/${project.github_repo}`}
              icon={<GithubIcon className="h-4 w-4 text-muted-foreground" />}
              links={[{ label: "Open repository", href: githubHref }]}
              children={
                githubBranches?.length ? (
                  <div className="space-y-2">
                    {githubBranches.map((branch) => (
                      <div
                        key={branch.branch}
                        className="rounded-md border border-border/50 p-2"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <span>{branch.branch}</span>
                          <span>{branch.commits.length} commits</span>
                        </div>
                        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[11px]">
                          {branch.commits.map((commit) => (
                            <div
                              key={commit.sha}
                              className="flex items-start gap-2"
                            >
                              <span className="font-mono text-muted-foreground/70">
                                {commit.sha.slice(0, 7)}
                              </span>
                              <a
                                href={commit.url}
                                target="_blank"
                                rel="noreferrer"
                                className="line-clamp-2 text-foreground hover:underline"
                              >
                                {commit.message}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : undefined
              }
            />
            {vercelMeta ? (
              <ResourceDetail
                title="Vercel Project"
                value={`${vercelMeta.teamSlug}/${vercelMeta.projectName}`}
                icon={
                  <VercelIconSvg className="h-4 w-4 text-muted-foreground" />
                }
                links={[
                  {
                    label: "Open Vercel project",
                    href: `https://vercel.com/${vercelMeta.teamSlug}/${vercelMeta.projectName}`,
                  },
                ]}
              />
            ) : null}
            <ResourceDetail
              title="TiDB Cloud"
              value={`Cluster ${project.tidbcloud_cluster_id}`}
              icon={<TiDBIcon className="h-4 w-4" />}
              children={
                tidbBranches?.length ? (
                  <div className="space-y-1 rounded-md border border-border/40 p-2 text-[12px]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Branches
                    </p>
                    <div className="space-y-1">
                      {tidbBranches.map((branch) => (
                        <div
                          key={branch.branchId}
                          className="flex items-center justify-between rounded-sm px-1 py-0.5"
                        >
                          <span className="font-medium text-foreground">
                            {branch.displayName ?? branch.branchId}
                          </span>
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {branch.state ?? "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : undefined
              }
              links={[
                {
                  label: "Open TiDB Cloud",
                  href: tidbHref,
                },
              ]}
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

function ResourceDetail({
  title,
  value,
  details,
  links,
  icon,
  children,
}: {
  title: string;
  value?: string;
  details?: { label: string; value: string }[];
  links?: { label: string; href: string }[];
  icon?: ReactElement;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
      </div>
      {value && <p className="text-sm font-medium text-foreground">{value}</p>}
      {details?.length ? (
        <table className="w-full text-[11px] text-muted-foreground/80">
          <tbody className="[&>tr]:border-b [&>tr:last-child]:border-none [&>tr]:border-border/50">
            {details.map((detail) => (
              <tr key={`${detail.label}-${detail.value}`}>
                <th className="py-1 pr-3 text-left font-semibold uppercase tracking-wide text-muted-foreground/80">
                  {detail.label}
                </th>
                <td className="py-1 text-foreground/90 break-all">
                  {detail.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {children}
      {links?.length ? (
        <div className="flex flex-wrap gap-3 text-xs">
          {links.map((link) => (
            <a
              key={link.href}
              className="flex items-center gap-1 text-primary underline-offset-2 hover:underline"
              href={link.href}
              rel="noreferrer"
              target="_blank"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M7 17 17 7" />
                <path d="m7 7h10v10" />
              </svg>
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
