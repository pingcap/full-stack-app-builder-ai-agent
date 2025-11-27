import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("task_revision")
    .addColumn("user_prompt", "text", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema
    .alterTable("task_revision")
    .dropColumn("user_prompt")
    .execute();
}
