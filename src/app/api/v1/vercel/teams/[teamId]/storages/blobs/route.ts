import { listBlobStorages } from "@/lib/vercel/blobs";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const teamId = decodeURIComponent((await params).teamId);

  return NextResponse.json(await listBlobStorages(teamId));
}
