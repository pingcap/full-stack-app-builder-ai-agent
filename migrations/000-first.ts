import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("user")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().notNull().autoIncrement(),
    )
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("password", "char(72)", (col) => col.notNull())
    .addColumn("email", "varchar(255)", (col) => col.notNull())
    .addColumn("avatar_url", "varchar(2047)", (col) => col.notNull())
    .addUniqueConstraint("uq_email", ["email"])
    .addUniqueConstraint("uq_name", ["name"])
    .execute();

  await db.schema
    .createTable("user_setting")
    .addColumn("user_id", "integer", (col) => col.primaryKey().notNull())
    .addColumn("github_login", "varchar(255)", (col) => col)
    .addColumn("github_token", "varchar(255)", (col) => col)
    .addColumn("tidbcloud_public_key", "varchar(255)", (col) => col)
    .addColumn("tidbcloud_private_key", "varchar(255)", (col) => col)
    .addColumn("tidbcloud_organization_id", "varchar(255)", (col) => col)
    .addColumn("tidbcloud_project_id", "varchar(255)", (col) => col)
    .addColumn("vercel_token", "varchar(255)", (col) => col)
    .addColumn("vercel_blob_team_id", "varchar(255)", (col) => col)
    .addColumn("vercel_blob_storage_id", "varchar(255)", (col) => col)
    .addColumn("vercel_blob_storage_rw_token", "varchar(255)", (col) => col)
    .addForeignKeyConstraint("fk_user_id", ["user_id"], "user", ["id"])
    .execute();

  await db.schema
    .createTable("project")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().notNull().autoIncrement(),
    )
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("description", "varchar(255)", (col) => col.notNull())

    .addColumn("status", "varchar(255)", (col) => col.notNull()) // 'preparing', 'error', 'ready'
    .addColumn("error_message", "text", (col) => col)

    .addColumn("github_repo", "varchar(255)", (col) => col.notNull())
    .addColumn("github_owner", "varchar(255)", (col) => col.notNull())

    .addColumn("tidbcloud_cluster_id", "varchar(255)", (col) => col.notNull())
    .addColumn("tidbcloud_connection_url", "varchar(255)", (col) =>
      col.notNull(),
    )

    .addColumn("vercel_team_id", "varchar(255)", (col) => col.notNull())
    .addColumn("vercel_team_token", "varchar(255)", (col) => col.notNull())
    .addColumn("vercel_project_id", "varchar(255)", (col) => col.notNull())

    .addColumn("user_id", "integer", (col) => col.notNull())
    .addUniqueConstraint("uq_github_repo", ["github_owner", "github_repo"])
    .addUniqueConstraint("uq_name", ["name"])
    .addForeignKeyConstraint("fk_user_id", ["user_id"], "user", ["id"])
    .execute();

  await db.schema
    .createTable("task")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().notNull().autoIncrement(),
    )
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("git_branch_name", "varchar(255)", (col) => col.notNull()) // this is the branch name to push to, do not change after creation
    .addColumn("git_revision_ref", "varchar(255)", (col) => col.notNull()) // this is the checkout ref, do not change after creation
    .addColumn("project_id", "integer", (col) => col.notNull())
    .addColumn("user_id", "integer", (col) => col.notNull())
    .addColumn("parent_task_id", "integer", (col) => col)
    .addColumn("parent_task_revision_ordinal", "integer", (col) => col)
    .addForeignKeyConstraint("fk_project_id", ["project_id"], "project", ["id"])
    .addForeignKeyConstraint("fk_user_id", ["user_id"], "user", ["id"])
    .addForeignKeyConstraint("fk_parent_task_id", ["parent_task_id"], "task", [
      "id",
    ])
    .execute();

  await db.schema
    .createTable("task_revision")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().notNull().autoIncrement(),
    )
    .addColumn("ordinal", "integer", (col) => col.notNull())
    .addColumn("prompt", "varchar(2047)", (col) => col.notNull())
    .addColumn("sandbox_type", "varchar(255)", (col) => col.notNull())

    .addColumn("status", "varchar(255)", (col) => col.notNull()) // 'preparing', 'running', 'completed', 'failed'
    .addColumn("error", "text", (col) => col)

    .addColumn("tidbcloud_branch_id", "varchar(255)", (col) => col)
    .addColumn("vercel_sandbox_id", "varchar(255)", (col) => col)

    .addColumn("agent_message", "json", (col) => col)
    .addColumn("agent_result", "text", (col) => col)

    .addColumn("git_commit_sha", "varchar(255)", (col) => col)

    .addColumn("project_id", "integer", (col) => col.notNull())
    .addColumn("task_id", "integer", (col) => col.notNull())
    .addColumn("user_id", "integer", (col) => col.notNull())

    .addColumn("created_at", "datetime", (col) => col.notNull())
    .addColumn("started_at", "datetime", (col) => col)
    .addColumn("stopped_at", "datetime", (col) => col)

    .addUniqueConstraint("uq_task_ordinal", ["task_id", "ordinal"])
    .addForeignKeyConstraint("fk_project_id", ["project_id"], "project", ["id"])
    .addForeignKeyConstraint("fk_task_id", ["task_id"], "task", ["id"])
    .addForeignKeyConstraint("fk_user_id", ["user_id"], "user", ["id"])
    .execute();

  await db.schema
    .createTable("tidbcloud_branch")
    .addColumn("id", "varchar(255)", (col) => col.primaryKey().notNull())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("status", "varchar(255)", (col) => col.notNull())
    .addColumn("connection_url", "varchar(255)", (col) => col)
    .addColumn("cluster_id", "varchar(255)", (col) => col.notNull())
    .addColumn("parent_id", "varchar(255)", (col) => col)
    .addColumn("created_at", "datetime", (col) => col.notNull())
    .addUniqueConstraint("uq_name", ["name"])
    .addForeignKeyConstraint(
      "fk_parent_id",
      ["parent_id"],
      "tidbcloud_branch",
      ["id"],
    )
    .execute();

  await db.schema
    .createTable("vercel_sandbox")
    .addColumn("id", "varchar(255)", (col) => col.primaryKey().notNull())
    .addColumn("user_id", "integer", (col) => col.notNull())
    .addColumn("status", "varchar(255)", (col) => col.notNull()) // 'pending' | 'busy'
    .addColumn("type", "varchar(255)", (col) => col.notNull())
    .addColumn("created_at", "datetime", (col) => col.notNull())
    .addColumn("updated_at", "datetime", (col) => col.notNull())
    .addColumn("stopped_at", "datetime", (col) => col)
    .addForeignKeyConstraint("fk_user_id", ["user_id"], "user", ["id"])
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable("tidbcloud_branch").execute();
  await db.schema.dropTable("vercel_sandbox").execute();
  await db.schema.dropTable("task_revision").execute();
  await db.schema.dropTable("task").execute();
  await db.schema.dropTable("project").execute();
  await db.schema.dropTable("user_setting").execute();
  await db.schema.dropTable("user").execute();
}
