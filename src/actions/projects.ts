import { randomUUID } from "node:crypto";
import { kebabCase } from "change-case";
import type { Insertable } from "kysely";
import { createConnection } from "mysql2/promise";
import { unauthorized } from "next/navigation";
import { Octokit } from "octokit";
import { raceYieldFromAsyncIterators } from "@/lib/async-generators";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db/db";
import type { DB } from "@/lib/db/schema";
import { getErrorMessage } from "@/lib/errors";
import { insert, update } from "@/lib/kysely-utils";
import { getSiteSettings } from "@/lib/system-settings";
import {
  createCluster,
  getCluster,
  type TiDBCloudSettings,
} from "@/lib/tidbcloud/sdk";
import { isGitHubSettingsValid } from "@/lib/user-settings/github";
import { isTiDBCloudSettingsValid } from "@/lib/user-settings/tidbcloud";
import {
  getVercelClient,
  isVercelSettingsValid,
} from "@/lib/user-settings/vercel";

type CreateProjectParams = Omit<
  Insertable<DB["project"]>,
  | "user_id"
  | "id"
  | "tidbcloud_cluster_id"
  | "tidbcloud_connection_url"
  | "vercel_project_id"
  | "vercel_team_token"
  | "status"
  | "error_message"
  | "github_repo"
  | "github_owner"
> & {
  github_repository_name?: string;
  vercel_project_name?: string;
  tidbcloud_cluster_name?: string;
};

type CreateProjectEvent =
  | {
      type: "creating-github-repo";
      owner: string;
      name: string;
    }
  | {
      type: "created-github-repo";
      mainBranchCommitSha: string;
    }
  | {
      type: "creating-db-project";
    }
  | {
      type: "created-db-project";
      id: number;
    }
  | {
      type: "project-ready";
    }
  | {
      type: "project-error";
      error: string;
    }
  | PrepareClusterEvent
  | PrepareVercelProjectEvent;

export async function* createProjectStreamed({
  name,
  description,
  vercel_team_id,
  github_repository_name,
  vercel_project_name,
  tidbcloud_cluster_name,
  coding_agent_type,
}: CreateProjectParams): AsyncGenerator<CreateProjectEvent> {
  const normalizedName = kebabCase(name);
  github_repository_name = github_repository_name ?? normalizedName;
  vercel_project_name = vercel_project_name ?? normalizedName;
  tidbcloud_cluster_name = tidbcloud_cluster_name ?? normalizedName;

  const user = await getSessionUser();
  const settings = await getSiteSettings();

  if (!user) {
    unauthorized();
  }

  if (!isGitHubSettingsValid(settings)) {
    throw new Error("GitHub settings are invalid.");
  }

  if (!isTiDBCloudSettingsValid(settings)) {
    throw new Error("TiDB Cloud settings are invalid.");
  }

  if (!isVercelSettingsValid(settings)) {
    throw new Error("Vercel settings are invalid.");
  }

  yield {
    type: "creating-github-repo",
    owner: settings.github_login,
    name: github_repository_name,
  };

  const octokit = new Octokit({ auth: settings.github_token });

  await octokit.rest.repos.createUsingTemplate({
    template_owner: "634750802",
    template_repo: "nextjs-tidbcloud-serverless-kysely-template",
    owner: settings.github_login,
    name: github_repository_name,
  });

  const RETRY_TIMES = 10;

  for (let i = 0; i < RETRY_TIMES; i++) {
    try {
      console.log(
        `Checking if branch main of ${settings.github_login}/${github_repository_name} exists...`,
      );
      const branch = await octokit.rest.repos.getBranch({
        branch: "main",
        repo: github_repository_name,
        owner: settings.github_login,
      });
      yield {
        type: "created-github-repo",
        mainBranchCommitSha: branch.data.commit.sha,
      };
      break;
    } catch {
      if (i === RETRY_TIMES) {
        throw new Error("failed to get the main branch of the repo.");
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  yield { type: "creating-db-project" };

  const project = await insert(db, "project", {
    user_id: user.id,
    name,
    description,
    github_repo: github_repository_name,
    github_owner: settings.github_login,
    status: "preparing",
    error_message: null,
    tidbcloud_cluster_id: "<UNSET>",
    tidbcloud_connection_url: "<UNSET>",
    vercel_team_id,
    vercel_project_id: "<UNSET>",
    vercel_team_token: "<UNSET>",
    coding_agent_type,
  });

  yield { type: "created-db-project", id: project.id };

  const prepareEvents = raceYieldFromAsyncIterators(
    prepareClusterStreamed(
      { name: tidbcloud_cluster_name, projectId: project.id },
      settings,
    ),
    prepareVercelProjectStreamed(
      {
        name: vercel_project_name,
        projectId: project.id,
        vercelTeamId: vercel_team_id,
        githubOwner: settings.github_login,
        githubRepo: name,
      },
      settings,
    ),
  );

  yield* prepareEvents;

  const result = prepareEvents.results;

  if (result.some((item) => item?.error != null)) {
    const errors = result
      .filter((item): item is { error: unknown } => item?.error != null)
      .map((item) => getErrorMessage(item.error));
    await update(
      db,
      "project",
      {
        status: "error",
        error_message: errors.join("\n"),
      },
      {
        id: project.id,
      },
    );
    yield { type: "project-error", error: errors.join("\n") };
  } else {
    await update(
      db,
      "project",
      {
        status: "ready",
      },
      {
        id: project.id,
      },
    );
    yield { type: "project-ready" };
  }
}

type PrepareClusterEvent =
  | {
      type: "creating-cluster";
      name: string;
    }
  | {
      type: "initializing-cluster";
    }
  | {
      type: "connecting-cluster";
    }
  | {
      type: "created-cluster";
    };

async function* prepareClusterStreamed(
  { name, projectId }: { name: string; projectId: number },
  settings: TiDBCloudSettings,
): AsyncGenerator<PrepareClusterEvent> {
  const rootPassword = randomUUID();

  yield { type: "creating-cluster", name };

  // Create and wait for the cluster to be active
  let cluster = await createCluster(
    { displayName: name, rootPassword },
    settings,
  );

  await update(
    db,
    "project",
    {
      tidbcloud_cluster_id: cluster.clusterId,
    },
    { id: projectId },
  );

  yield { type: "initializing-cluster" };

  while (true) {
    if (cluster.state !== "CREATING") {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    cluster = await getCluster(cluster.clusterId, settings);
  }

  if (cluster.state !== "ACTIVE") {
    throw new Error(
      `Failed to start cluster ${cluster.clusterId}. ${cluster.state}`,
    );
  }

  // Create the database
  const database = "dev";

  const baseConnectionUrl = `https://${cluster.userPrefix}.root:${rootPassword}@${process.env.TIDB_CLOUD_DATABASE_ENDPOINT!}:4000`;
  const databaseConnectionUrl = `${baseConnectionUrl}/${database}`;

  yield { type: "connecting-cluster" };

  // Create the default database
  const clusterDb = await createConnection({
    uri: baseConnectionUrl,
    ssl: { rejectUnauthorized: true },
  });
  await clusterDb.execute(`CREATE DATABASE IF NOT EXISTS ${database}`);

  await update(
    db,
    "project",
    {
      tidbcloud_connection_url: databaseConnectionUrl,
    },
    { id: projectId },
  );

  yield { type: "created-cluster" };
}

export type PrepareVercelProjectEvent =
  | {
      type: "creating-vercel-project";
      name: string;
    }
  | {
      type: "created-vercel-project";
    };

async function* prepareVercelProjectStreamed(
  {
    name,
    projectId,
    vercelTeamId,
    githubOwner,
    githubRepo,
  }: {
    name: string;
    projectId: number;
    vercelTeamId: string;
    githubOwner: string;
    githubRepo: string;
  },
  settings: Record<"vercel_token", string>,
): AsyncGenerator<PrepareVercelProjectEvent> {
  const cli = getVercelClient(settings.vercel_token);

  // Create the Vercel project
  const vercelProject = await cli.projects.createProject({
    teamId: vercelTeamId,
    requestBody: {
      name,
      ssoProtection: null,
    },
  });
  const signal = AbortSignal.timeout(10000);
  yield { type: "creating-vercel-project", name };

  // poll vercel project state
  while (true) {
    if (signal.aborted) {
      break;
    }
    try {
      const { name: projectName } = await fetch(
        `https://api.vercel.com/v1/projects/${projectId}?teamId=${vercelTeamId}`,
        {
          headers: {
            Authorization: `Bearer ${settings.vercel_token}`,
          },
          signal: signal,
        },
      ).then((res) => {
        if (!res.ok) {
          return { name: undefined };
        }
        return res.json();
      });
      if (projectName) {
        break;
      }
    } catch {
      if (signal.aborted) {
        break;
      }
    }
  }

  await update(
    db,
    "project",
    {
      vercel_project_id: vercelProject.id,
      vercel_team_token: settings.vercel_token,
    },
    { id: projectId },
  );

  yield { type: "created-vercel-project" };
}
