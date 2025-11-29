import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("ui_session")
    .modifyColumn("project_id", "integer", (col) => col)
    .modifyColumn("task_id", "integer", (col) => col)
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("logs", "json", (col) => col.notNull())
    .addColumn("message", "json", (col) => col)
    .execute();

  await db
    .updateTable("ui_session")
    .set({
      logs: "[]",
    })
    .execute();
}

export async function down(db: Kysely<any>) {
  await db
    .deleteFrom("ui_session")
    .where((eb) =>
      eb.or([eb("project_id", "is", null), eb("task_id", "is", null)]),
    )
    .execute();
  await db.schema
    .alterTable("ui_session")
    .modifyColumn("project_id", "integer", (col) => col.notNull())
    .modifyColumn("task_id", "integer", (col) => col.notNull())
    .dropColumn("title")
    .dropColumn("logs")
    .dropColumn("message")
    .execute();
}
