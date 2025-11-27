import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("ui_session")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().autoIncrement().notNull(),
    )
    .addColumn("slug", "varchar(255)", (col) => col.notNull())
    .addColumn("user_id", "integer", (col) => col.notNull())
    .addColumn("project_id", "integer", (col) => col.notNull())
    .addColumn("task_id", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("updated_at", "timestamp", (col) => col.notNull())
    .addUniqueConstraint("uq_project_task", ["project_id", "task_id"])
    .addUniqueConstraint("uq_slug", ["slug"])
    .addForeignKeyConstraint("fk_user_id", ["user_id"], "user", ["id"])
    .addForeignKeyConstraint("fk_project_id", ["project_id"], "project", ["id"])
    .addForeignKeyConstraint("fk_task_id", ["task_id"], "task", ["id"])
    .execute();

  await db.schema
    .alterTable("user_setting")
    .addColumn("default_vercel_project_team_id", "varchar(255)", (col) => col)
    .execute();

  await db
    .updateTable("user_setting")
    .set(({ ref }) => ({
      default_vercel_project_team_id: ref("vercel_blob_team_id"),
    }))
    .execute();

  await db.schema
    .alterTable("task_revision")
    .modifyColumn("prompt", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .alterTable("project")
    .modifyColumn("description", "text", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema
    .alterTable("user_setting")
    .dropColumn("default_vercel_project_team_id")
    .execute();
  await db.schema.dropTable("ui_session").execute();
}
