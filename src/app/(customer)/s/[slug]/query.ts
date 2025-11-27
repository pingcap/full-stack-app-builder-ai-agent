import db from "@/lib/db/db";
import { get } from "@/lib/kysely-utils";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/mysql";
import { cache } from "react";

export async function getSessionData(slug: string) {
  return await db
    .selectFrom("ui_session")
    .select((eb) => [
      "id",
      "slug",
      "project_id",
      "task_id",
      "created_at",
      "updated_at",
      "user_id",
      jsonObjectFrom(
        eb
          .selectFrom("project")
          .select([
            "id",
            "name",
            "status",
            "error_message",
            "github_owner",
            "github_repo",
            "vercel_team_id",
            "vercel_project_id",
            "tidbcloud_cluster_id",
          ])
          .where("project.id", "=", eb.ref("ui_session.project_id")),
      ).as("project"),
      jsonObjectFrom(
        eb
          .selectFrom("task")
          .select(["id", "name", "git_branch_name", "git_revision_ref"])
          .where("task.id", "=", eb.ref("ui_session.task_id")),
      ).as("task"),
      jsonArrayFrom(
        eb
          .selectFrom("task_revision")
          .select([
            "id",
            "prompt",
            "user_prompt",
            "ordinal",
            "sandbox_type",
            "status",
            "error",
            "tidbcloud_branch_id",
            "vercel_sandbox_id",
            "agent_message",
            "agent_result",
            "git_commit_sha",
            "created_at",
            "started_at",
            "stopped_at",
            "project_id",
            "task_id",
          ])
          .where("task_id", "=", eb.ref("ui_session.task_id"))
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
