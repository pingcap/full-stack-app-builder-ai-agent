import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("system_settings")
    .addColumn("key", "varchar(255)", (col) => col.primaryKey().notNull())
    .addColumn("value", "json", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable("system_settings").execute();
}
