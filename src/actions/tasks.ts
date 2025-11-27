import db from "@/lib/db/db";
import type { DB } from "@/lib/db/schema";
import { insert } from "@/lib/kysely-utils";
import type { Insertable } from "kysely";

type CreateTaskParams = Omit<Insertable<DB["task"]>, "id">;

export async function createTask(params: CreateTaskParams) {
  const task = await insert(db, "task", {
    ...params,
  });

  return task;
}
