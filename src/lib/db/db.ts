import type { DB } from "@/lib/db/schema";
import { TiDBServerlessDialect } from "@tidbcloud/kysely";
import { Kysely } from "kysely";

const db = new Kysely<DB>({
  dialect: new TiDBServerlessDialect({
    url: process.env.DATABASE_URL,
  }),
});

export default db;
