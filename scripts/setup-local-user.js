import { hash } from "bcrypt";
import { Octokit } from "octokit";
import readline from "readline/promises";
import db from "../src/lib/db/db.ts";
import { insert } from "../src/lib/kysely-utils.ts";

const firstSettings = await db
  .selectFrom("user_setting")
  .selectAll()
  .where("user_id", "=", 1)
  .executeTakeFirst();

const rl = new readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let email, password, github_token;

github_token = await rl.question("github_token> ");
const octokit = new Octokit({ auth: github_token });
const { data: ghUser } = await octokit.rest.users.getAuthenticated();

password = await rl.question("password> ");

if (!ghUser.email) {
  email = await rl.question("email (will used as github commit email)> ");
} else {
  email = ghUser.email;
}

await db.transaction().execute(async (trx) => {
  const user = await insert(trx, "user", {
    name: ghUser.login,
    password: await hash(password, process.env.BCRYPT_SALT),
    avatar_url: ghUser.avatar_url,
    email: email,
  });

  await trx
    .insertInto("user_setting")
    .values({
      ...firstSettings,
      user_id: user.id,
      github_login: ghUser.login,
      github_token,
    })
    .execute();
});

await db.destroy();
