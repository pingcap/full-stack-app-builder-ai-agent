import { randomUUID } from "node:crypto";
import { connect } from "@tidbcloud/serverless";
import { kebabCase } from "change-case";
import type { Insertable } from "kysely";
import { after, NextResponse } from "next/server";
import { Octokit } from "octokit";
import { getSessionUserSettings } from "@/lib/auth";
import db from "@/lib/db/db";
import type { DB } from "@/lib/db/schema";
import { insert, update } from "@/lib/kysely-utils";
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

export async function createProject({
  name,
  description,
  vercel_team_id,
  github_repository_name,
  vercel_project_name,
  tidbcloud_cluster_name,
}: CreateProjectParams) {
  const normalizedName = kebabCase(name);
  github_repository_name = github_repository_name ?? normalizedName;
  vercel_project_name = vercel_project_name ?? normalizedName;
  tidbcloud_cluster_name = tidbcloud_cluster_name ?? normalizedName;

  const settings = await getSessionUserSettings();
  if (!settings) {
    throw NextResponse.json(
      {
        message: "Invalid user settings.",
      },
      { status: 400 },
    );
  }

  if (!isGitHubSettingsValid(settings)) {
    throw NextResponse.json(
      {
        message: "GitHub settings are invalid.",
      },
      { status: 400 },
    );
  }

  if (!isTiDBCloudSettingsValid(settings)) {
    throw NextResponse.json(
      {
        message: "TiDB Cloud settings are invalid.",
      },
      { status: 400 },
    );
  }

  if (!isVercelSettingsValid(settings)) {
    throw NextResponse.json(
      {
        message: "Vercel settings are invalid.",
      },
      { status: 400 },
    );
  }

  const octokit = new Octokit({ auth: settings.github_token });

  await octokit.rest.repos.createUsingTemplate({
    template_owner: "634750802",
    template_repo: "nextjs-tidbcloud-serverless-kysely-template",
    owner: settings.github_login,
    name: github_repository_name,
  });

  for (let i = 0; i < 10; i++) {
    try {
      console.log(
        `Checking if branch main of ${settings.github_login}/${github_repository_name} exists...`,
      );
      await octokit.rest.repos.getBranch({
        branch: "main",
        repo: github_repository_name,
        owner: settings.github_login,
      });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  const project = await insert(db, "project", {
    user_id: settings.user_id,
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
  });

  after(async () => {
    try {
      await Promise.all([
        prepareCluster(
          { name: tidbcloud_cluster_name, projectId: project.id },
          settings,
        ),
        prepareVercelProject(
          {
            name: vercel_project_name,
            projectId: project.id,
            vercelTeamId: vercel_team_id,
            githubOwner: settings.github_login,
            githubRepo: name,
          },
          settings,
        ),
      ]);

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
    } catch (e) {
      await update(
        db,
        "project",
        {
          status: "error",
          error_message: String((e as any)?.message ?? "Unknown error"),
        },
        {
          id: project.id,
        },
      );
    }
  });

  return project;
}

async function prepareCluster(
  { name, projectId }: { name: string; projectId: number },
  settings: TiDBCloudSettings,
) {
  const rootPassword = randomUUID();

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

  // Create the default database
  const clusterDb = connect({
    url: baseConnectionUrl,
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
}

async function prepareVercelProject(
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
) {
  const cli = getVercelClient(settings.vercel_token);

  // Create the Vercel project
  const vercelProject = await cli.projects.createProject({
    teamId: vercelTeamId,
    requestBody: {
      name,
    },
  });
  await update(
    db,
    "project",
    { vercel_project_id: vercelProject.id },
    { id: projectId },
  );

  // TODO Install github app

  // Create a Vercel team token
  const { bearerToken: vercelTeamToken } =
    await cli.authentication.createAuthToken({
      teamId: vercelTeamId,
      requestBody: {
        name: `Auth Token for ${name}`,
      },
    });
  await update(
    db,
    "project",
    { vercel_team_token: vercelTeamToken },
    { id: projectId },
  );
}
