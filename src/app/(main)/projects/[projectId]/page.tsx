import { Vercel } from "@vercel/sdk";
import { Suspense } from "react";
import { TasksList } from "@/app/(main)/projects/[projectId]/tasks-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import db from "@/lib/db/db";
import { get } from "@/lib/kysely-utils";
import { getSiteSettings } from "@/lib/system-settings";
import {
  getGitHubClient,
  isGitHubSettingsValid,
} from "@/lib/user-settings/github";
import { isVercelSettingsValid } from "@/lib/user-settings/vercel";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const projectId = parseInt(decodeURIComponent((await params).projectId));

  const project = await get(db, "project", { id: projectId });

  return (
    <div className="space-y-4">
      <ItemGroup className="grid gap-4 grid-cols-2">
        <Suspense>
          <GitHubRepoInfo
            owner={project.github_owner}
            repo={project.github_repo}
          />
        </Suspense>
        <Suspense>
          <VercelProjectInfo
            teamId={project.vercel_team_id}
            projectId={project.vercel_project_id}
            token={project.vercel_team_token}
          />
        </Suspense>
      </ItemGroup>
      <Suspense>
        <Tasks projectId={projectId} />
      </Suspense>
    </div>
  );
}

async function GitHubRepoInfo({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const settings = await getSiteSettings();
  if (!isGitHubSettingsValid(settings)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Failed to get github info</AlertTitle>
        <AlertDescription>GitHub account not setup.</AlertDescription>
      </Alert>
    );
  }

  try {
    const client = await getGitHubClient(settings.github_token);
    const { data: repository } = await client.rest.repos.get({
      owner,
      repo,
    });

    return (
      <Item variant="outline">
        <ItemHeader>Github Project</ItemHeader>
        <ItemMedia variant="icon" className="overflow-hidden">
          <img src={repository.owner.avatar_url} alt={repository.owner.login} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{repository.full_name}</ItemTitle>
          <ItemDescription>
            {repository.description ?? "No description"}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <a
            className={buttonVariants({ variant: "outline" })}
            href={repository.html_url}
            target="_blank"
            rel="noreferrer"
          >
            Visit
          </a>
        </ItemActions>
      </Item>
    );
  } catch (e) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Failed to get github info</AlertTitle>
        <AlertDescription>
          {String((e as any)?.message ?? "Unknown Error")}
        </AlertDescription>
      </Alert>
    );
  }
}

async function VercelProjectInfo({
  projectId,
  teamId,
  token,
}: {
  projectId: string;
  teamId: string;
  token: string;
}) {
  const settings = await getSiteSettings();
  if (!isVercelSettingsValid(settings)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Failed to get vercel project info</AlertTitle>
        <AlertDescription>Vercel account not setup.</AlertDescription>
      </Alert>
    );
  }

  try {
    const sdk = new Vercel({
      bearerToken: token,
    });

    const { slug: teamSlug, avatar } = await sdk.teams.getTeam({
      teamId,
    });

    const { name: projectName } = await fetch(
      `https://api.vercel.com/v1/projects/${projectId}?teamId=${teamId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    ).then((res) => {
      if (!res.ok) {
        throw new Error("Failed to fetch vercel project info");
      }
      return res.json();
    });

    return (
      <Item variant="outline">
        <ItemHeader>Vercel Project</ItemHeader>
        {avatar && (
          <ItemMedia variant="icon" className="overflow-hidden">
            <img
              src={`https://vercel.com/api/www/avatar/${avatar}`}
              alt={teamSlug}
            />
          </ItemMedia>
        )}
        <ItemContent>
          <ItemTitle>
            {teamSlug} / {projectName}
          </ItemTitle>
        </ItemContent>
        <ItemActions>
          <a
            className={buttonVariants({ variant: "outline" })}
            href={`https://vercel.com/${teamSlug}/${projectName}`}
            target="_blank"
            rel="noreferrer"
          >
            Visit
          </a>
        </ItemActions>
      </Item>
    );
  } catch (e) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Failed to get vercel project info</AlertTitle>
        <AlertDescription>
          {String((e as any)?.message ?? "Unknown Error")}
        </AlertDescription>
      </Alert>
    );
  }
}

async function Tasks({ projectId }: { projectId: number }) {
  const tasks = await db
    .selectFrom("task")
    .selectAll("task")
    .select(({ selectFrom, ref }) =>
      selectFrom("task_revision")
        .select(({ fn }) => fn.countAll<number>().as("count"))
        .where("task_revision.task_id", "=", ref("task.id"))
        .as("revisions_count"),
    )
    .where("project_id", "=", projectId)
    .execute();

  return <TasksList tasks={tasks} projectId={projectId} />;
}
