import { hash } from "bcrypt";
import db from "../src/lib/db/db.ts";
import { insert } from "../src/lib/kysely-utils.ts";

await db.transaction().execute(async (trx) => {
  await insert(trx, "user", {
    name: "admin",
    password: await hash("password", process.env.BCRYPT_SALT),
    avatar_url: "",
    email: "admin@example.com",
  });
});

await db.destroy();
