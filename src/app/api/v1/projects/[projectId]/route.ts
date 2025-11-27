import db from "@/lib/db/db";
import { get, omit } from "@/lib/kysely-utils";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const id = parseInt(decodeURIComponent((await params).projectId));

  return NextResponse.json(
    omit(await get(db, "project", { id }), [
      "tidbcloud_connection_url",
      "vercel_team_token",
    ]),
  );
}
