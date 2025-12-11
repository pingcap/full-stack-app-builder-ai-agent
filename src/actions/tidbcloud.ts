import { randomUUID } from "node:crypto";
import db from "@/lib/db/db";
import { get, update } from "@/lib/kysely-utils";
import { getSiteSettings } from "@/lib/system-settings";
import { createBranch, getBranch } from "@/lib/tidbcloud/sdk";
import { isTiDBCloudSettingsValid } from "@/lib/user-settings/tidbcloud";

export async function createTiDBCloudBranch(
  projectId: number,
  taskId: number,
  taskRevisionId: number,
) {
  const settings = await getSiteSettings();

  if (!isTiDBCloudSettingsValid(settings)) {
    throw new Error("TiDB Cloud settings are invalid");
  }

  const project = await get(db, "project", { id: projectId });
  if (!project.tidbcloud_cluster_id) {
    throw new Error("Project does not have a tidbcloud cluster id");
  }

  const taskRevision = await get(db, "task_revision", { id: taskRevisionId });

  let parentId: string | undefined;

  if (taskRevision.ordinal > 1) {
    const parentRevision = await get(db, "task_revision", {
      task_id: taskId,
      ordinal: taskRevision.ordinal - 1,
    });
    if (!parentRevision.tidbcloud_branch_id) {
      throw new Error("Parent revision does not have a tidbcloud branch id");
    }

    parentId = parentRevision.tidbcloud_branch_id;
  }

  const rootPassword = randomUUID();

  let branch = await createBranch(
    {
      displayName: `tasks-${taskId}-revision-${taskRevisionId}`,
      rootPassword,
      clusterId: project.tidbcloud_cluster_id,
      parentId,
    },
    settings,
  );

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("tidbcloud_branch")
      .values({
        id: branch.branchId,
        name: branch.name,
        status: "preparing",
        connection_url: null,
        cluster_id: project.tidbcloud_cluster_id,
        parent_id: parentId,
        created_at: new Date(),
      })
      .execute();

    await update(
      trx,
      "task_revision",
      {
        tidbcloud_branch_id: branch.branchId,
      },
      { id: taskRevisionId },
    );
  });

  console.log("polling branch state");

  while (true) {
    if (branch.state === "CREATING") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      branch = await getBranch(
        project.tidbcloud_cluster_id,
        branch.branchId,
        settings,
      );
    } else {
      break;
    }
  }

  if (branch.state !== "ACTIVE") {
    await update(
      db,
      "tidbcloud_branch",
      {
        status: "failed",
      },
      { id: branch.branchId },
    );
    throw new Error(
      `Failed to create branch ${branch.branchId}. ${branch.state}`,
    );
  } else {
    const connectionUrl = `https://${branch.userPrefix}.root:${rootPassword}@${process.env.TIDB_CLOUD_DATABASE_ENDPOINT!}:4000/dev`;
    await update(
      db,
      "tidbcloud_branch",
      {
        connection_url: connectionUrl,
        status: "ready",
      },
      { id: branch.branchId },
    );
  }

  return await get(db, "tidbcloud_branch", { id: branch.branchId });
}
