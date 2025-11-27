import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/db";
import { get } from "@/lib/kysely-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vercelSandboxId: string }> },
) {
  const id = decodeURIComponent((await params).vercelSandboxId);
  const projectId = parseInt(
    String(request.nextUrl.searchParams.get("projectId")),
    10,
  );

  const project = await get(db, "project", { id: projectId });

  const sandbox = await Sandbox.get({
    sandboxId: id,
    projectId: project.vercel_project_id,
    teamId: project.vercel_team_id,
    token: project.vercel_team_token,
  });

  return NextResponse.json({
    3000: sandbox.domain(3000),
  });
}
