import * as fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import {
  FileMigrationProvider,
  Kysely,
  type MigrationResultSet,
  Migrator,
  MysqlDialect,
} from "kysely";
import {
  GeneratorDialect,
  generate,
  Logger,
  MysqlAdapter,
  MysqlIntrospector,
} from "kysely-codegen";
import { createPool } from "mysql2";

const dirname = import.meta.dirname;

if (process.argv[2] === "init") {
  const url = new URL(process.env.DATABASE_URL!);
  const database = url.pathname.substring(1);
  url.pathname = "";
  const dbUrl = url.toString();

  const initDialect = new MysqlDialect({
    pool: createPool({
      uri: dbUrl,
      ssl: {
        rejectUnauthorized: true,
      },
    }),
  });

  const db = new Kysely({
    dialect: initDialect,
  });

  await db.schema.createSchema(database).execute();

  await db.destroy();
  process.exit(0);
}

const dialect = new MysqlDialect({
  pool: createPool({
    uri: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: true,
    },
  }),
});

const db = new Kysely({
  dialect,
  log: (event) => {
    if (event.level === "query") {
      process.stdout.write(
        chalk.gray(
          `  ✓ [${Math.floor(event.queryDurationMillis)}ms] ${event.query.sql}\n`,
        ),
      );
    } else {
      process.stdout.write(
        chalk.red(
          `  ✕ [${Math.floor(event.queryDurationMillis)}ms] ${event.query.sql}\n`,
        ),
      );
      console.error(event.error);
    }
  },
});

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    path,
    fs: fs.promises,
    migrationFolder: path.join(dirname, "../migrations"),
  }),
});

let result: MigrationResultSet;

switch (process.argv[2]) {
  case "up-to-latest":
    result = await migrator.migrateToLatest();
    break;
  case "up":
    result = await migrator.migrateUp();
    break;
  case "down":
    result = await migrator.migrateDown();
    break;
  default:
    console.error('Invalid command. Use "up-to-latest", "up", or "down".');
    process.exit(1);
}

if (result.results) {
  for (const item of result.results) {
    let logStr = `${item.direction === "Up" ? "[up]" : "[down]"} ${item.migrationName} `;
    if (item.status === "Success") {
      logStr = chalk.green(`✓ ${logStr}`);
    } else if (item.status === "Error") {
      logStr = chalk.red(`✕ ${logStr}`);
    } else {
      logStr = chalk.gray(`- ${logStr}`);
    }
    console.log(logStr);
  }
}

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

await generate({
  outFile: "src/lib/db/schema.d.ts",
  dialect: new (class extends GeneratorDialect {
    adapter = new MysqlAdapter();
    introspector = new MysqlIntrospector();

    createKyselyDialect() {
      return Promise.resolve(dialect);
    }
  })(),
  db,
  logger: new Logger("info"),
});

await db.destroy();
