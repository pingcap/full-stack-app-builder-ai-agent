import { type NextRequest, NextResponse } from "next/server";
import { createTaskRevision } from "@/actions/task-revisions";
import db from "@/lib/db/db";
import { get, getAll } from "@/lib/kysely-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> },
) {
  const taskId = parseInt(decodeURIComponent((await params).taskId));

  const revisions = await getAll(db, "task_revision", { task_id: taskId }, [
    "ordinal",
    "asc",
  ]);

  return NextResponse.json(revisions);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> },
) {
  const taskId = parseInt(decodeURIComponent((await params).taskId));
  const projectId = parseInt(decodeURIComponent((await params).projectId));

  const { prompt } = await request.json();
  const project = await get(db, "project", { id: projectId });

  const taskRevision = await createTaskRevision({
    task_id: taskId,
    sandbox_type: project.coding_agent_type as never,
    prompt,
    user_prompt: prompt,
  });

  return NextResponse.json(taskRevision);
}
