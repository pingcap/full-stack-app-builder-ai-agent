import { Vercel } from "@vercel/sdk";
import { SDKError } from "@vercel/sdk/models/sdkerror";
import type { Selectable } from "kysely";
import { NextResponse } from "next/server";
import { Octokit } from "octokit";
import db from "@/lib/db/db";
import type { DB } from "@/lib/db/schema";
import { getErrorMessage } from "@/lib/errors";
import { get, omit, update } from "@/lib/kysely-utils";
import { getSiteSettings } from "@/lib/system-settings";
import { deleteCluster } from "@/lib/tidbcloud/sdk";
import { isGitHubSettingsValid } from "@/lib/user-settings/github";
import { isTiDBCloudSettingsValid } from "@/lib/user-settings/tidbcloud";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const id = parseInt(decodeURIComponent((await params).projectId), 10);

  return NextResponse.json(
    omit(await get(db, "project", { id }), [
      "tidbcloud_connection_url",
      "vercel_team_token",
    ]),
  );
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const id = parseInt(decodeURIComponent((await params).projectId), 10);
    const project = await get(db, "project", { id });

    await update(
      db,
      "project",
      {
        status: "deleting",
        error_message: null,
      },
      { id },
    );

    await Promise.all([
      deleteVercelProject(project),
      deleteTidbcloudCluster(project),
      deleteGithubRepository(project),
    ]);

    await db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("task_revision")
        .where("project_id", "=", project.id)
        .execute();

      await trx
        .deleteFrom("ui_session")
        .where("project_id", "=", project.id)
        .execute();
      await trx
        .deleteFrom("task")
        .where("project_id", "=", project.id)
        .execute();
      await trx.deleteFrom("project").where("id", "=", project.id).execute();
    });
  } catch (e) {
    return NextResponse.json(
      {
        message: getErrorMessage(e),
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ message: "Project deleted." });
}

async function deleteVercelProject(project: Selectable<DB["project"]>) {
  if (project.vercel_project_id === "<DELETETED>") {
    return;
  }

  const vercel = new Vercel({
    bearerToken: project.vercel_team_token,
  });

  try {
    await vercel.projects.deleteProject({
      teamId: project.vercel_team_id,
      idOrName: project.vercel_project_id,
    });
  } catch (error) {
    if (!isIgnorableVercelDeletionError(error)) {
      throw error;
    }
  }

  await update(
    db,
    "project",
    {
      vercel_project_id: "<DELETETED>",
      vercel_team_token: "<DELETETED>",
      vercel_team_id: "<DELETETED>",
    },
    { id: project.id },
  );
}

function isIgnorableVercelDeletionError(error: unknown) {
  if (error instanceof SDKError) {
    if (error.statusCode === 404) {
      return true;
    }

    try {
      const parsed = JSON.parse(error.body ?? "{}");
      if (parsed?.error?.invalidToken || parsed?.error?.code === "forbidden") {
        return true;
      }
    } catch {
      // ignore parse issues
    }
  }

  return false;
}

async function deleteTidbcloudCluster(project: Selectable<DB["project"]>) {
  if (project.tidbcloud_cluster_id === "<DELETETED>") {
    return;
  }

  const settings = await getSiteSettings();
  if (!settings) {
    throw new Error("Invalid user.");
  }
  if (!isTiDBCloudSettingsValid(settings)) {
    throw new Error("TiDB Cloud settings are invalid.");
  }

  await db
    .deleteFrom("tidbcloud_branch")
    .where("cluster_id", "=", project.tidbcloud_cluster_id)
    .execute();

  await deleteCluster(project.tidbcloud_cluster_id, settings);

  await update(
    db,
    "project",
    {
      tidbcloud_cluster_id: "<DELETETED>",
      tidbcloud_connection_url: "<DELETETED>",
    },
    { id: project.id },
  );
}

async function deleteGithubRepository(project: Selectable<DB["project"]>) {
  if (project.github_repo === "<DELETETED>") {
    return;
  }
  const settings = await getSiteSettings();
  if (!settings) {
    throw new Error("Invalid user.");
  }
  if (!isGitHubSettingsValid(settings)) {
    throw new Error("GitHub settings are invalid.");
  }

  const octokit = new Octokit({ auth: settings.github_token });
  await octokit.rest.repos.delete({
    owner: project.github_owner,
    repo: project.github_repo,
  });

  await update(
    db,
    "project",
    { github_owner: "<DELETETED>", github_repo: "<DELETETED>" },
    { id: project.id },
  );
}
