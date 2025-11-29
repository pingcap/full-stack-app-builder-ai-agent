import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/mysql";
import { cache } from "react";
import db from "@/lib/db/db";
import { get } from "@/lib/kysely-utils";

export async function getSessionData(slug: string) {
  return await db
    .selectFrom("ui_session")
    .select((eb) => [
      "ui_session.id",
      "ui_session.title",
      "ui_session.slug",
      "ui_session.project_id",
      "ui_session.task_id",
      "ui_session.created_at",
      "ui_session.updated_at",
      "ui_session.user_id",
      "ui_session.logs",
      "ui_session.message",
      jsonObjectFrom(
        eb
          .selectFrom("project")
          .select([
            "project.id",
            "project.name",
            "project.status",
            "project.error_message",
            "project.github_owner",
            "project.github_repo",
            "project.vercel_team_id",
            "project.vercel_project_id",
            "project.tidbcloud_cluster_id",
            "project.coding_agent_type",
          ])
          .where("project.id", "=", eb.ref("ui_session.project_id")),
      ).as("project"),
      jsonObjectFrom(
        eb
          .selectFrom("task")
          .select([
            "task.id",
            "task.name",
            "task.git_branch_name",
            "task.git_revision_ref",
          ])
          .where("task.id", "=", eb.ref("ui_session.task_id")),
      ).as("task"),
      jsonArrayFrom(
        eb
          .selectFrom("task_revision")
          .select([
            "task_revision.id",
            "task_revision.prompt",
            "task_revision.user_prompt",
            "task_revision.ordinal",
            "task_revision.sandbox_type",
            "task_revision.status",
            "task_revision.error",
            "task_revision.tidbcloud_branch_id",
            "task_revision.vercel_sandbox_id",
            "task_revision.agent_message",
            "task_revision.agent_result",
            "task_revision.git_commit_sha",
            "task_revision.created_at",
            "task_revision.started_at",
            "task_revision.stopped_at",
            "task_revision.project_id",
            "task_revision.task_id",
            "task_revision.vercel_deployment_id",
          ])
          .where("task_revision.task_id", "=", eb.ref("ui_session.task_id"))
          .orderBy("ordinal", "asc"),
      ).as("task_revisions"),
    ])
    .where("slug", "=", slug)
    .executeTakeFirstOrThrow();
}

export type UISessionData = Awaited<ReturnType<typeof getSessionData>>;

export const getProject = cache(
  async (id: number) => await get(db, "project", { id }),
);
