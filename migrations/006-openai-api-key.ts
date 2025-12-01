import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("user_setting")
    .addColumn("openai_api_key", "varchar(255)", (col) => col)
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema
    .alterTable("user_setting")
    .dropColumn("openai_api_key")
    .execute();
}
