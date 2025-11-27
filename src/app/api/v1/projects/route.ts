import { createProject } from "@/actions/projects";
import { omit } from "@/lib/kysely-utils";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  name: z
    .string()
    .regex(
      /^[a-z]([a-z0-9-_\s]*)/i,
      "Must start with a letter, followed by letters, numbers, dashes, or underscores.",
    ),
  description: z.string().optional().default(""),
  vercel_team_id: z.string(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = requestSchema.parse(body);

  const project = await createProject({
    ...data,
    coding_agent_type: "codex",
  });

  return NextResponse.json(
    omit(project, ["tidbcloud_connection_url", "tidbcloud_cluster_id"]),
  );
}
