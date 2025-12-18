import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.transaction().execute(async (trx) => {
    const users = await trx.selectFrom("user").selectAll().execute();

    if (users.length === 0) return;

    await trx
      .insertInto("account")
      .values(
        users.map((user) => ({
          account_id: String(user.id),
          provider_id: "credential",
          user_id: user.id,
          password: user.password,
          created_at: user.created_at,
          updated_at: user.updated_at,
        })),
      )
      .execute();
  });
}

export async function down() {}
