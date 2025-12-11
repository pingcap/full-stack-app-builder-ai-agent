import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema.alterTable("user").dropColumn("password").execute();
}

export async function down(db: Kysely<any>) {
  await db.schema
    .alterTable("user")
    .addColumn("password", "char(72)", (col) => col.notNull())
    .execute();
}
