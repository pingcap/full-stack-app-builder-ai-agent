import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const p = await params;
  const session = decodeURIComponent(p.sessionId);

  console.log(
    `${process.env.STREAM_PROXY_URL}/v2/streams/${session}/stream?format=vercel-ai-ui-message-stream-v1`,
  );
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
