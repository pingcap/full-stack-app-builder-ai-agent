import type {
  AnyColumn,
  ExpressionOrFactory,
  FilterObject,
  Insertable,
  OrderByExpression,
  OrderByModifiers,
  QueryCreator,
  Selectable,
  SelectType,
  SqlBool,
  Updateable,
} from "kysely";
import type { DB } from "@/lib/db/schema";

export type DrainOuterGeneric<T> = [T] extends [unknown] ? T : never;

export type AllSelection<DB, TB extends keyof DB> = DrainOuterGeneric<{
  [C in AnyColumn<DB, TB>]: {
    [T in TB]: SelectType<C extends keyof DB[T] ? DB[T][C] : never>;
  }[TB];
}>;

export async function insert<TB extends keyof DB & string>(
  db: QueryCreator<DB>,
  table: TB,
  values: Insertable<DB[TB]>,
): Promise<Selectable<DB[TB]>> {
  const { insertId } = await db
    .insertInto(table)
    .values(values)
    .executeTakeFirstOrThrow();

  const dat = await db
    .selectFrom(table as keyof DB & string)
    .selectAll()
    .where("id", "=", Number(insertId!))
    .executeTakeFirstOrThrow();

  return dat as Selectable<DB[TB]>;
}

export async function get<TB extends keyof DB & string>(
  db: QueryCreator<DB>,
  table: TB,
  expression: ExpressionOrFactory<DB, TB, SqlBool> | FilterObject<DB, TB>,
) {
  return (await db
    .selectFrom(table as keyof DB & string)
    .selectAll()
    .where(
      typeof expression === "object"
        ? (eb) => eb.and(expression as never)
        : (expression as never),
    )
    .executeTakeFirstOrThrow()) as Selectable<DB[TB]>;
}

export async function find<TB extends keyof DB & string>(
  db: QueryCreator<DB>,
  table: TB,
  expression: ExpressionOrFactory<DB, TB, SqlBool> | FilterObject<DB, TB>,
) {
  return (await db
    .selectFrom(table as keyof DB & string)
    .selectAll()
    .where(
      typeof expression === "object"
        ? (eb) => eb.and(expression as never)
        : (expression as never),
    )
    .executeTakeFirst()) as Selectable<DB[TB]>;
}

export async function getAll<TB extends keyof DB & string>(
  db: QueryCreator<DB>,
  table: TB,
  expression: ExpressionOrFactory<DB, TB, SqlBool> | FilterObject<DB, TB>,
  orderBy?: [OrderByExpression<DB, TB, AllSelection<DB, TB>>, OrderByModifiers],
  limit?: number,
) {
  let builder = db
    .selectFrom(table as keyof DB & string)
    .selectAll()
    .where(
      typeof expression === "object"
        ? (eb) => eb.and(expression as never)
        : (expression as never),
    );
  if (orderBy != null) {
    builder = builder.orderBy((orderBy as any)[0], orderBy[1]);
  }

  if (limit != null) {
    builder = builder.limit(limit);
  }
  return (await builder.execute()) as Selectable<DB[TB]>[];
}

export async function countAll<TB extends keyof DB & string>(
  db: QueryCreator<DB>,
  table: TB,
  expression: ExpressionOrFactory<DB, TB, SqlBool> | FilterObject<DB, TB>,
) {
  const { count } = await db
    .selectFrom(table as keyof DB & string)
    .select((eb) => eb.fn.countAll().as("count"))
    .where(
      typeof expression === "object"
        ? (eb) => eb.and(expression as never)
        : (expression as never),
    )
    .executeTakeFirstOrThrow();

  const c = Number(count);
  if (isNaN(c)) {
    throw new Error(`Invalid count: ${count}`);
  }

  return c;
}

export async function update<TB extends keyof DB & string>(
  db: QueryCreator<DB>,
  table: TB,
  values: Updateable<DB[TB]>,
  expression: ExpressionOrFactory<DB, TB, SqlBool> | FilterObject<DB, TB>,
) {
  return await db
    .updateTable(table as keyof DB & string)
    .set(values)
    .where(
      typeof expression === "object"
        ? (eb) => eb.and(expression as never)
        : (expression as never),
    )
    .execute();
}

export function omit<T extends object, K extends (keyof T & string)[]>(
  value: T,
  keys: K,
) {
  const obj: Omit<T, K[number]> = { ...value };
  for (const key of keys) {
    delete (obj as any)[key];
  }
  return obj;
}
