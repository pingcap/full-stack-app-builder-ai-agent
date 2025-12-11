import { Sandbox } from "@vercel/sandbox";
import ms from "ms";
import db from "@/lib/db/db";
import { get, update } from "@/lib/kysely-utils";
import { getSiteSettings } from "@/lib/system-settings";
import { generateSessionId } from "@/lib/tasks";
import { isGitHubSettingsValid } from "@/lib/user-settings/github";
import { isVercelSettingsValid } from "@/lib/user-settings/vercel";
import { startSandbox } from "@/sandboxes/sandbox-util";

export async function createSandbox(
  projectId: number,
  taskId: number,
  taskRevisionId: number,
) {
  const settings = await getSiteSettings();

  if (!isGitHubSettingsValid(settings)) {
    throw new Error("GitHub settings are invalid");
  }

  if (!isVercelSettingsValid(settings)) {
    throw new Error("TiDB Cloud settings are invalid");
  }

  const project = await get(db, "project", { id: projectId });
  const task = await get(db, "task", { id: taskId });
  const taskRevision = await get(db, "task_revision", { id: taskRevisionId });
  let revision = task.git_revision_ref;
  let lastSession: string | undefined;
  if (taskRevision.ordinal > 1) {
    const lastRevision = await get(db, "task_revision", {
      task_id: taskId,
      ordinal: taskRevision.ordinal - 1,
    });
    if (!lastRevision.git_commit_sha) {
      throw new Error("Previous revision does not have a git commit sha");
    }
    revision = lastRevision.git_commit_sha;
    lastSession = generateSessionId(projectId, taskId, lastRevision.id);
  }

  for await (const event of startSandbox({
    user_id: project.user_id,
    coding_agent_type: project.coding_agent_type as never,
    session: generateSessionId(projectId, taskId, taskRevisionId),
    lastSession,
    gitBranch: task.git_branch_name,
    gitRevision: revision,
    blobId: settings.vercel_blob_storage_id,
    teamId: project.vercel_team_id,
    projectId: project.vercel_project_id,
    token: project.vercel_team_token,
    source: {
      type: "git",
      url: `https://${settings.github_login}:${settings.github_token}@github.com/${project.github_owner}/${project.github_repo}.git`,
      revision,
    },
    ports: [3000, 8888],
    timeout: ms("45min"),
    resources: {
      vcpus: 4,
    },
    stdout: process.stdout,
    stderr: process.stderr,
  })) {
    switch (event.type) {
      case "created":
        await db.transaction().execute(async (trx) => {
          await trx
            .insertInto("vercel_sandbox")
            .values({
              id: event.sandbox.sandboxId,
              user_id: project.user_id,
              status: "preparing",
              type: taskRevision.sandbox_type,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .execute();

          await update(
            trx,
            "task_revision",
            {
              vercel_sandbox_id: event.sandbox.sandboxId,
            },
            { id: taskRevisionId },
          );
        });
        break;
      case "setup":
      case "resume":
        await db
          .updateTable("vercel_sandbox")
          .set({
            status: `${event.type}:${event.cmdId}`,
            updated_at: new Date(),
          })
          .where("id", "=", event.sandboxId)
          .execute();
        break;
    }
  }

  const { vercel_sandbox_id } = await get(db, "task_revision", {
    id: taskRevisionId,
  });
  if (!vercel_sandbox_id) {
    throw new Error("Failed to create sandbox");
  }

  await db
    .updateTable("vercel_sandbox")
    .set({
      status: "ready",
      updated_at: new Date(),
    })
    .where("id", "=", vercel_sandbox_id)
    .execute();

  return await Sandbox.get({
    sandboxId: vercel_sandbox_id,
    token: project.vercel_team_token,
    teamId: project.vercel_team_id,
    projectId: project.vercel_project_id,
  });
}
