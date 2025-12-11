import { Kysely, MysqlDialect } from "kysely";
import { createPool } from "mysql2";
import type { DB } from "@/lib/db/schema";

const db = new Kysely<DB>({
  dialect: new MysqlDialect({
    pool: createPool({
      uri: process.env.DATABASE_URL!,
      ssl: {
        rejectUnauthorized: true,
      },
    }),
  }),
});

export default db;
