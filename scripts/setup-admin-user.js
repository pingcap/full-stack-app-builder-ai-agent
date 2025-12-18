import { hash } from "bcrypt";
import db from "../src/lib/db/db.ts";
import { insert } from "../src/lib/kysely-utils.ts";
import { sh } from "./common.js";

const password = sh("openssl", "rand", "-hex", "16");

await db.transaction().execute(async (trx) => {
  const user = await insert(trx, "user", {
    name: "admin",
    avatar_url: "",
    email: "admin@example.com",
    email_verified: 0,
    role: "admin",
  });

  await insert(trx, "account", {
    user_id: user.id,
    account_id: "admin",
    provider_id: "credential",
    password: await hash(password, process.env.BCRYPT_SALT),
    created_at: new Date(),
    updated_at: new Date(),
  });
});

await db.destroy();

console.log(`login email: admin@example.com`);
console.log(`login password: ${password}`);
