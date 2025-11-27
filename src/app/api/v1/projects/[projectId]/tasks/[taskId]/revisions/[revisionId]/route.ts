import db from "@/lib/db/db";
import { get } from "@/lib/kysely-utils";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ projectId: string; taskId: string; revisionId: string }>;
  },
) {
  const revisionId = parseInt(decodeURIComponent((await params).revisionId));
  const taskId = parseInt(decodeURIComponent((await params).taskId));

  return NextResponse.json(
    await get(db, "task_revision", { id: revisionId, task_id: taskId }),
  );
}
