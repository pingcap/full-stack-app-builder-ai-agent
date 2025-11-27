import db from "@/lib/db/db";
import { get } from "@/lib/kysely-utils";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vercelSandboxId: string }> },
) {
  const id = decodeURIComponent((await params).vercelSandboxId);
  return NextResponse.json(await get(db, "vercel_sandbox", { id }));
}
