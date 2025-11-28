import type { Kysely } from "kysely";

export async function up(kysely: Kysely<any>) {
  await kysely.schema
    .alterTable("project")
    .addColumn("auto_deployment", "boolean", (col) =>
      col.notNull().defaultTo(0),
    )
    .execute();

  await kysely.schema
    .alterTable("task_revision")
    .addColumn("vercel_deployment_id", "varchar(255)", (col) => col)
    .addColumn("vercel_deployment_status", "varchar(255)", (col) => col)
    .addColumn("vercel_deployment_error", "text", (col) => col)
    .execute();
}

export async function down(kysely: Kysely<any>) {
  await kysely.schema
    .alterTable("task_revision")
    .dropColumn("vercel_deployment_id")
    .dropColumn("vercel_deployment_status")
    .dropColumn("vercel_deployment_error")
    .execute();
  await kysely.schema
    .alterTable("project")
    .dropColumn("auto_deployment")
    .execute();
}
