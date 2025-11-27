import db from "@/lib/db/db";
import { get, omit } from "@/lib/kysely-utils";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const branchId = decodeURIComponent((await params).branchId);
  return NextResponse.json(
    omit(await get(db, "tidbcloud_branch", { id: branchId }), [
      "connection_url",
    ]),
  );
}
