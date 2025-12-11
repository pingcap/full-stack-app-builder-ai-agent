import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { type Kysely, sql } from "kysely";

const filename = fileURLToPath(import.meta.url);

const upFilename = filename.replace(/\.ts$/, ".up.sql");
const downFilename = filename.replace(/\.ts$/, ".down.sql");

async function readMigrationSQLQueries(db: Kysely<any>, filename: string) {
  const content = await fs.promises.readFile(filename, "utf-8");

  return content
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      return sql.raw(s).compile(db);
    });
}

export async function up(db: Kysely<any>): Promise<void> {
  const queries = await readMigrationSQLQueries(db, upFilename);

  for (const query of queries) {
    await db.executeQuery(query);
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  const queries = await readMigrationSQLQueries(db, downFilename);

  for (const query of queries) {
    await db.executeQuery(query);
  }
}
