import { generateSessionId } from "@/lib/tasks";
import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ projectId: string; taskId: string; revisionId: string }>;
  },
) {
  const p = await params;
  const projectId = parseInt(decodeURIComponent(p.projectId));
  const taskId = parseInt(decodeURIComponent(p.taskId));
  const revisionId = parseInt(decodeURIComponent(p.revisionId));

  const session = generateSessionId(projectId, taskId, revisionId);

  const response = await fetch(
    `${process.env.STREAM_PROXY_URL}/v2/streams/${session}/stream?format=vercel-ai-ui-message-stream-v1`,
  );
  if (!response.ok) {
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "unknown",
      },
      status: response.status,
    });
  }

  return new NextResponse(response.body, {
    headers: {
      ...UI_MESSAGE_STREAM_HEADERS,
    },
  });
}
