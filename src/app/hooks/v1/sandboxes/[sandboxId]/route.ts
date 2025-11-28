import { Sandbox } from "@vercel/sandbox";
import type { Credentials } from "@vercel/sandbox/dist/utils/get-credentials";
import {
  parseJsonEventStream,
  readUIMessageStream,
  type UIMessage,
  uiMessageChunkSchema,
} from "ai";
import { notFound } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deployTask } from "@/actions/task-revisions";
import db from "@/lib/db/db";
import { getErrorMessage } from "@/lib/errors";
import { get, getAll, update } from "@/lib/kysely-utils";

const requestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("sandbox_finished"),
    session: z.string(),
    git_commit_sha: z.string(),
    result: z.string().optional(),
  }),
  z.object({
    type: z.literal("sandbox_interrupted"),
    session: z.string(),
    git_commit_sha: z.string().optional(),
    reason: z.string(),
    result: z.string().optional(),
  }),
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> },
) {
  const token = request.headers.get("Authorization");
  if (!token) {
    return new NextResponse(null, { status: 401 });
  }
  if (token !== `Bearer ${process.env.HOOK_AUTH_TOKEN}`) {
    return new NextResponse(null, { status: 403 });
  }

  const sandboxId = decodeURIComponent((await params).sandboxId);
  const [taskRevision] = await getAll(
    db,
    "task_revision",
    { vercel_sandbox_id: sandboxId },
    ["created_at", "desc"],
    1,
  );

  if (!taskRevision) {
    notFound();
  }

  if (taskRevision.status !== "running") {
    return NextResponse.json(
      {
        message: "Invalid task revision state",
      },
      { status: 409 },
    );
  }

  const project = await get(db, "project", { id: taskRevision.project_id });

  const event = requestSchema.parse(await request.json());

  let logs: string | null = null;

  try {
    const dbSandbox = await get(db, "vercel_sandbox", { id: sandboxId });
    if (dbSandbox.status.startsWith("cmd:")) {
      const sandbox = await Sandbox.get({
        sandboxId,
        teamId: project.vercel_team_id,
        projectId: project.vercel_project_id,
        token: project.vercel_team_token,
      });
      const cmdId = dbSandbox.status.replace(/^cmd:/, "");
      const cmd = await sandbox.getCommand(cmdId);
      try {
        if (cmd.exitCode == null) {
          const stoppedCmd = await cmd.wait({
            signal: AbortSignal.timeout(10000),
          });
          if (stoppedCmd.exitCode !== 0) {
            logs = await stoppedCmd.output("both");
          }
        } else {
          if (cmd.exitCode !== 0) {
            logs = await cmd.output("both");
          }
        }
      } catch (e) {
        logs = `Failed to get command exit code ${cmdId}: ${getErrorMessage(e)}`;
      }
    }
  } catch {}

  await Promise.all([
    handleSandbox(sandboxId, {
      teamId: project.vercel_team_id,
      projectId: project.vercel_project_id,
      token: project.vercel_team_token,
    }),
    handleTaskRevisionResult(event, taskRevision, project, logs),
  ]);

  return NextResponse.json({
    message: "OK",
  });
}

async function handleSandbox(sandboxId: string, credentials: Credentials) {
  const sandbox = await Sandbox.get({
    sandboxId,
    ...credentials,
  });

  if (sandbox.status === "running") {
    // void sandbox.stop();
  }

  await update(
    db,
    "vercel_sandbox",
    {
      status: "stopped",
      stopped_at: new Date(),
    },
    { id: sandboxId },
  );
}

async function handleTaskRevisionResult(
  event: z.infer<typeof requestSchema>,
  taskRevision: Awaited<ReturnType<typeof get<"task_revision">>>,
  project: Awaited<ReturnType<typeof get<"project">>>,
  logs: string | null,
) {
  switch (event.type) {
    case "sandbox_finished": {
      const message = await collectStream(event.session);
      await update(
        db,
        "task_revision",
        {
          status: project.auto_deployment === 1 ? "deploying" : "finished",
          error: logs,
          stopped_at: new Date(),
          agent_message: JSON.stringify(message ?? null),
          agent_result: event.result || null,
          git_commit_sha: event.git_commit_sha,
        },
        { id: taskRevision.id },
      );

      try {
        await deployTask(
          taskRevision.project_id,
          taskRevision.task_id,
          taskRevision.id,
        );
      } catch (e) {
        console.error(e);
      } finally {
        await update(
          db,
          "task_revision",
          {
            status: "finished",
          },
          { id: taskRevision.id },
        );
      }

      break;
    }
    case "sandbox_interrupted": {
      const message = await collectStream(event.session);

      await update(
        db,
        "task_revision",
        {
          status: "interrupted",
          error: logs,
          stopped_at: new Date(),
          agent_message: JSON.stringify(message ?? null),
          agent_result: event.result || null,
          git_commit_sha: event.git_commit_sha,
        },
        { id: taskRevision.id },
      );
      break;
    }
  }
}

async function collectStream(session: string) {
  let lastMessage: UIMessage | undefined;

  try {
    const timeout = 10000;

    const response = await fetch(
      `${process.env.STREAM_PROXY_URL}/v2/streams/${session}/stream?format=vercel-ai-ui-message-stream-v1`,
    );
    if (!response.ok) {
      return Promise.reject(
        Error(`Failed to fetch stream: ${response.statusText}`),
      );
    }

    const messageStream = readUIMessageStream({
      stream: parseJsonEventStream({
        stream: response.body!,
        schema: uiMessageChunkSchema,
      }).pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            if (chunk.success) {
              controller.enqueue(chunk.value);
            } else {
              console.error(
                "Error parsing stream chunk:",
                chunk.rawValue,
                chunk.error,
              );
            }
          },
        }),
      ),
    });

    const th = setTimeout(() => messageStream.cancel(), timeout);

    for await (const message of messageStream) {
      lastMessage = message;
    }

    clearTimeout(th);
  } catch (e) {
    console.error(e);
  }
  return lastMessage;
}
