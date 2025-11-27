import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("project")
    .addColumn("coding_agent_type", "varchar(255)", (col) => col.notNull())
    .execute();

  await db.updateTable("project").set("coding_agent_type", "codex").execute();
}

export async function down(db: Kysely<any>) {
  await db.schema
    .alterTable("project")
    .dropColumn("coding_agent_type")
    .execute();
}
