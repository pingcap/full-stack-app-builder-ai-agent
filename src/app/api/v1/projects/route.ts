import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createProjectStreamed } from "@/actions/projects";
import { consumeAsyncIterator } from "@/lib/async-generators";
import db from "@/lib/db/db";
import { getErrorMessage } from "@/lib/errors";
import { get, omit } from "@/lib/kysely-utils";

const requestSchema = z.object({
  name: z
    .string()
    .regex(
      /^[a-z]([a-z0-9-_\s]*)/i,
      "Must start with a letter, followed by letters, numbers, dashes, or underscores.",
    ),
  description: z.string().optional().default(""),
  vercel_team_id: z.string(),
  coding_agent_type: z.enum(["codex", "claude", "claude-opus"]),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = requestSchema.parse(body);

  const iter = createProjectStreamed(data);

  try {
    for await (const chunk of iter) {
      if (chunk.type === "created-db-project") {
        after(consumeAsyncIterator(iter));
        return NextResponse.json(
          omit(await get(db, "project", { id: chunk.id }), [
            "tidbcloud_connection_url",
          ]),
        );
      }
    }
    return NextResponse.json(
      {
        message:
          "Failed to create project. Please check the logs for more details.",
      },
      { status: 400 },
    );
  } catch (e) {
    return NextResponse.json(
      {
        message: getErrorMessage(e),
      },
      { status: 400 },
    );
  }
}
