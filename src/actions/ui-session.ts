import { convertArrayToReadableStream } from "@ai-sdk/provider-utils/test";
import { readUIMessageStream } from "ai";
import { kebabCase } from "change-case";
import { sql } from "kysely";
import { unauthorized } from "next/navigation";
import { createProjectStreamed } from "@/actions/projects";
import { createTaskRevision } from "@/actions/task-revisions";
import { createTask } from "@/actions/tasks";
import { raceYieldFromAsyncIterators } from "@/lib/async-generators";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db/db";
import { getErrorMessage } from "@/lib/errors";
import { get, insert, update } from "@/lib/kysely-utils";
import { getSiteSettings } from "@/lib/system-settings";
import { isGitHubSettingsValid } from "@/lib/user-settings/github";
import {
  generateUISessionStep1,
  generateUISessionStep2,
  generateUISessionStep3,
  type UISessionMessage,
  type UISessionMessageChunk,
  type UISessionMessageTools,
} from "@/prompts/ui-session";

export async function* createUISession({
  first_prompt: userPrompt,
  coding_agent_type,
}: {
  first_prompt: string;
  coding_agent_type: string;
}): AsyncGenerator<UISessionMessageChunk> {
  const suffix = Math.random().toString(36).substring(2, 6);

  let id: number | undefined;

  try {
    for await (const chunk of _create()) {
      if (id) {
        await appendLogs(id, Array.isArray(chunk) ? chunk : [chunk]);
      }
      if (Array.isArray(chunk)) {
        for (const chunkElement of chunk) {
          yield chunkElement;
        }
      } else {
        yield chunk;
      }
    }
  } catch (e) {
    if (id != null) {
      await appendLogs(id, [{ type: "error", errorText: getErrorMessage(e) }]);
    } else {
      return Promise.reject(e);
    }
  }

  async function* _create(): AsyncGenerator<
    UISessionMessageChunk | UISessionMessageChunk[]
  > {
    const user = await getSessionUser();
    const settings = await getSiteSettings();

    if (!user) {
      unauthorized();
    }

    if (!settings) {
      throw new Error("Settings are invalid.");
    }

    if (!isGitHubSettingsValid(settings)) {
      throw new Error("GitHub settings are invalid.");
    }
    if (!settings?.default_vercel_project_team_id) {
      throw new Error("Default Vercel project team id is not set.");
    }

    const step1 = await generateUISessionStep1({ userPrompt });
    const slug = `${step1.slug}-${suffix}`;

    const { id: uiSessionId } = await insert(db, "ui_session", {
      slug,
      title: step1.title,
      logs: "[]",
      user_id: user.id,
      created_at: new Date(),
      updated_at: new Date(),
    });
    id = uiSessionId;
    yield [
      { type: "start", messageId: `ui-session:${uiSessionId}` },
      {
        type: "tool-input-available",
        toolCallId: "setup:generate-meta-info",
        toolName: "generate-meta-fields",
        input: undefined,
      },
    ];
    const step2 = await generateUISessionStep2({ step1, userPrompt });
    yield [
      {
        type: "tool-output-available",
        toolCallId: "setup:generate-meta-info",
        output: step2,
      },
      {
        type: "tool-input-available",
        toolCallId: "setup:detect-user-intent",
        toolName: "detect-user-intent",
        input: undefined,
      },
    ];
    const step3Promise = generateUISessionStep3({ step1, step2, userPrompt });

    const gfpIter = wrapToolCall("detect-user-intent", step3Promise, (r) => r);

    const createProjectEvents = createProjectStreamed({
      name: `${kebabCase(step2.project_name)}-${suffix}`,
      description: "",
      vercel_team_id: settings.default_vercel_project_team_id,
      github_repository_name: `${step2.github_repository_name}-${suffix}`,
      tidbcloud_cluster_name: `${step2.tidbcloud_cluster_name}-${suffix}`,
      vercel_project_name: `${step2.vercel_project_name}-${suffix}`,
      coding_agent_type,
      auto_deployment: 1,
    });

    const allEvents = raceYieldFromAsyncIterators(gfpIter, createProjectEvents);

    let projectId: number | undefined;
    let git_revision_ref: string | undefined;
    let createTaskPromise: ReturnType<typeof createTask> | undefined;
    for await (const event of allEvents) {
      switch (event.type) {
        case "tool-output-available":
        case "tool-output-error":
          yield event;
          break;
        case "created-db-project":
          projectId = event.id;
          await update(
            db,
            "ui_session",
            { project_id: projectId },
            { id: uiSessionId },
          );
          break;
        case "creating-github-repo":
          yield {
            type: "tool-input-available",
            toolCallId: "setup:create-github-repo",
            toolName: "create-github-repo",
            input: { owner: event.owner, name: event.name },
          };
          break;
        case "created-github-repo":
          yield {
            type: "tool-output-available",
            toolCallId: "setup:create-github-repo",
            output: undefined,
          };
          git_revision_ref = event.mainBranchCommitSha;
          break;
        case "creating-cluster":
          yield {
            type: "tool-input-available",
            toolCallId: "setup:create-tidbcloud-cluster",
            toolName: "create-tidbcloud-cluster",
            input: { name: event.name },
          };
          break;
        case "created-cluster":
          yield {
            type: "tool-output-available",
            toolCallId: "setup:create-tidbcloud-cluster",
            output: undefined,
          };
          break;
        case "creating-vercel-project":
          yield {
            type: "tool-input-available",
            toolCallId: "setup:create-vercel-project",
            toolName: "create-vercel-project",
            input: { name: event.name },
          };
          break;
        case "created-vercel-project":
          yield {
            type: "tool-output-available",
            toolCallId: "setup:create-vercel-project",
            output: undefined,
          };
          break;
        case "project-ready":
          if (projectId == null) {
            throw new Error("bad state: projectId is undefined");
          }
          await update(
            db,
            "project",
            {
              status: "ready",
            },
            { id: projectId },
          );
          yield {
            type: "finish",
          };
          break;
        case "project-error":
          yield {
            type: "error",
            errorText: event.error,
          };
          throw new Error(event.error);
        default:
          break;
      }

      if (projectId != null && git_revision_ref != null) {
        createTaskPromise = createTask({
          name: step2.first_task_name,
          git_branch_name: step2.first_task_branch_name,
          git_revision_ref: git_revision_ref,
          project_id: projectId,
          parent_task_id: null,
          parent_task_revision_ordinal: null,
          user_id: user.id,
        }).then(async (task) => {
          await update(
            db,
            "ui_session",
            { task_id: task.id },
            { id: uiSessionId },
          );
          return task;
        });
      }
    }

    const updateSessionPromise = (async () => {
      const session = await get(db, "ui_session", { id: uiSessionId });

      const reader = readUIMessageStream<UISessionMessage>({
        stream: convertArrayToReadableStream<UISessionMessageChunk>(
          Array.isArray(session.logs) ? (session.logs as never) : [],
        ),
      });

      try {
        let lastMessage: UISessionMessage | null = null;
        for await (const message of reader) {
          lastMessage = message;
        }

        await update(
          db,
          "ui_session",
          {
            message: JSON.stringify(lastMessage),
          },
          { id: uiSessionId },
        );
      } catch (e) {
        console.error(e);
      }
    })();

    if (!createTaskPromise) {
      throw new Error("bad state: createTaskPromise is undefined");
    }

    const [task, step3] = await Promise.all([createTaskPromise, step3Promise]);

    await Promise.all([
      updateSessionPromise,
      createTaskRevision({
        sandbox_type: coding_agent_type as never,
        task_id: task.id,
        prompt: step3.prompt,
        user_prompt: userPrompt,
      }),
    ]);
  }
}

async function appendLogs(id: number, logs: UISessionMessageChunk[]) {
  if (logs.length === 0) {
    return;
  }
  await db
    .updateTable("ui_session")
    .set("logs", (eb) =>
      eb.fn("json_array_append", [
        "logs",
        ...logs.flatMap((item) => [
          sql.lit("$"),
          eb.fn("json_extract", [eb.val(JSON.stringify(item)), sql.lit("$")]),
        ]),
      ]),
    )
    .where("id", "=", id)
    .execute();
}

async function* wrapToolCall<P extends keyof UISessionMessageTools, R>(
  tool: P,
  promise: Promise<R>,
  getOutput: (result: R) => UISessionMessageTools[P]["output"],
): AsyncGenerator<
  UISessionMessageChunk & {
    type: "tool-output-available" | "tool-output-error";
  }
> {
  try {
    const result = await promise;
    yield {
      type: "tool-output-available",
      toolCallId: `setup:${tool}`,
      output: getOutput(result),
    };
  } catch (e) {
    yield {
      type: "tool-output-error",
      toolCallId: `setup:${tool}`,
      errorText: getErrorMessage(e),
    };
  }
}
