import { getTaskRevisionCommandStatus } from "@/actions/task-revisions";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ revisionId: string }> },
) {
  const revisionId = parseInt(decodeURIComponent((await params).revisionId));
  return NextResponse.json(await getTaskRevisionCommandStatus(revisionId));
}
