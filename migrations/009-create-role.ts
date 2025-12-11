import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("user")
    .addColumn("role", "varchar(255)", (col) => col.notNull().defaultTo("user"))
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.alterTable("user").dropColumn("role").execute();
}
