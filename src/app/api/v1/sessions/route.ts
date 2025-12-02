import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createUISession } from "@/actions/ui-session";
import { consumeAsyncIterator } from "@/lib/async-generators";
import db from "@/lib/db/db";
import { get } from "@/lib/kysely-utils";
import type { UISessionMessageChunk } from "@/prompts/ui-session";

const requestSchema = z.object({
  first_prompt: z.string(),
  coding_agent_type: z.enum(["codex", "claude", "claude-opus"]),
});

export type CreateSessionResult = ReturnType<typeof POST> extends Promise<
  NextResponse<infer U>
>
  ? U
  : never;

export async function POST(request: NextRequest) {
  const body = requestSchema.parse(await request.json());

  const events = createUISession(body);
  const id = await consumeIteratorUntilStart(events);

  if (id != null) {
    after(() => consumeAsyncIterator(events));
    return NextResponse.json(
      await get(db, "ui_session", {
        id,
      }),
    );
  }

  return NextResponse.json(
    {
      message: "Bad state",
    } as never,
    { status: 500 },
  );
}

async function consumeIteratorUntilStart(
  iterator: AsyncGenerator<UISessionMessageChunk, void, unknown>,
) {
  while (true) {
    const ev = await iterator.next();
    if (ev.done) {
      break;
    }
    if (ev.value.type === "start") {
      return parseInt(ev.value.messageId!.replace(/^ui-session:/, ""), 10);
    }
  }

  return undefined;
}
