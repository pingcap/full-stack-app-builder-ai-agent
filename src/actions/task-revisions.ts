import { Sandbox } from "@vercel/sandbox";
import { Vercel } from "@vercel/sdk";
import type { CreateCustomEnvironmentResponseBody } from "@vercel/sdk/models/createcustomenvironmentop";
import type { GetCustomEnvironmentResponseBody } from "@vercel/sdk/models/getcustomenvironmentop";
import type { Insertable } from "kysely";
import { after, NextResponse } from "next/server";
import { quote } from "shell-quote";
import { createTiDBCloudBranch } from "@/actions/tidbcloud";
import { createSandbox } from "@/actions/vercel";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db/db";
import type { DB } from "@/lib/db/schema";
import { extractEnvs } from "@/lib/envs";
import { getErrorMessage } from "@/lib/errors";
import { get, getAll, insert, update } from "@/lib/kysely-utils";
import { getSiteSettings } from "@/lib/system-settings";
import { generateSessionId } from "@/lib/tasks";

type CreateTaskRevisionParams = Pick<
  Insertable<DB["task_revision"]>,
  "prompt" | "task_id" | "user_prompt"
> & {
  sandbox_type: "codex" | "claude" | "claude-opus";
};

export async function createTaskRevision(params: CreateTaskRevisionParams) {
  const settings = await getSiteSettings();
  const user = await getSessionUser();

  const task = await get(db, "task", { id: params.task_id });
  const project = await get(db, "project", { id: task.project_id });
  const previousRevision = (
    await getAll(
      db,
      "task_revision",
      { task_id: params.task_id },
      ["ordinal", "desc"],
      1,
    )
  )[0];
  const taskRevision = await insert(db, "task_revision", {
    ...params,
    status: "preparing", //'preparing', 'running', 'completed', 'failed'
    ordinal: (previousRevision?.ordinal ?? 0) + 1,
    created_at: new Date(),
    project_id: task.project_id,
    user_id: task.user_id,
  });

  console.log("created task revision", taskRevision);
  after(async () => {
    const session = generateSessionId(project.id, task.id, taskRevision.id);
    console.log("preparing task revision");

    try {
      const [branch, sandbox] = await Promise.all([
        createTiDBCloudBranch(project.id, task.id, taskRevision.id),
        createSandbox(project.id, task.id, taskRevision.id),
      ]);

      await update(
        db,
        "task_revision",
        {
          status: "running",
          started_at: new Date(),
        },
        { id: taskRevision.id },
      );

      await sandbox.writeFiles([
        {
          path: ".env.local",
          content: Buffer.from(
            `DATABASE_URL=${branch.connection_url}\nOPENAI_API_KEY=${process.env.OPENAI_API_KEY ?? ""}\n`,
            "utf-8",
          ),
        },
      ]);

      await sandbox.runCommand({
        cmd: "npm",
        args: ["run", "dev"],
        detached: true,
      });

      const command = await sandbox.runCommand({
        cmd: "bash",
        args: [
          "-c",
          `

call_err_hook() {
  EVENT_PAYLOAD=$(jq -c -M -n --arg session "$SANDBOX_SESSION_ID" --arg commit "$GIT_COMMIT_SHA" --arg reason "Please check logs." --arg result "$RESULT_TXT" '{ type: "sandbox_interrupted", session: $session, git_commit_sha: $commit, reason: $reason, result: $result }')
  echo "Call err hook..."
  echo POST "$HOOK_BASE_URL/hooks/v1/sandboxes/$SANDBOX_ID"
  echo $EVENT_PAYLOAD | jq
  curl  -X POST "$HOOK_BASE_URL/hooks/v1/sandboxes/$SANDBOX_ID" \\
      -H "Authorization: Bearer $HOOK_AUTH_TOKEN" \\
      -H "Content-Type: application/json" \\
      -d "$EVENT_PAYLOAD"
}

call_finish_hook() {
  EVENT_PAYLOAD=$(jq -c -M -n --arg session "$SANDBOX_SESSION_ID" --arg commit "$GIT_COMMIT_SHA" --arg result "$RESULT_TXT" '{ type: "sandbox_finished", session: $session, git_commit_sha: $commit, result: $result }')
  echo "Call finish hook..."
  echo POST "$HOOK_BASE_URL/hooks/v1/sandboxes/$SANDBOX_ID"
  echo $EVENT_PAYLOAD | jq
  curl  -X POST "$HOOK_BASE_URL/hooks/v1/sandboxes/$SANDBOX_ID" \\
      -H "Authorization: Bearer $HOOK_AUTH_TOKEN" \\
      -H "Content-Type: application/json" \\
      -d "$EVENT_PAYLOAD"
}

set -eE

trap call_err_hook ERR

# executing coding agent
echo "Executing coding agent..."
code-tee --stream-server-url ${quote([process.env.STREAM_PROXY_URL!])} --stream-id ${quote([session])} ${project.coding_agent_type.startsWith("claude-") ? "claude" : project.coding_agent_type} ${quote([params.prompt])} ${agentOptions[project.coding_agent_type]} 1>/tmp/result.txt
RESULT_TXT=$(cat /tmp/result.txt || echo '')

# push commit
echo "Pushing commit to GitHub..."
git config user.name ${settings?.github_login}
git config user.email ${user?.email}
git add .
git commit --allow-empty -m ${quote([params.user_prompt])}
git push origin ${task.git_branch_name}
GIT_COMMIT_SHA=$(git rev-parse HEAD)

# save ${project.coding_agent_type} sessions
echo "Saving ${project.coding_agent_type} sessions..."
cd ~
zip ${project.coding_agent_type}-data.zip -r ${quote(filesToZip[project.coding_agent_type])}
vercel telemetry disable
vercel blob put ${project.coding_agent_type}-data.zip --token "$VERCEL_TOKEN" --rw-token "$BLOB_READ_WRITE_TOKEN" --force --pathname "${project.coding_agent_type}-sessions/$USER_ID/$SANDBOX_SESSION_ID/${project.coding_agent_type}-data.zip"

# finish this command
call_finish_hook
`,
        ],
        detached: true,
        env: {
          VERCEL_TOKEN: settings?.vercel_token!,
          SANDBOX_SESSION_ID: session,
          SANDBOX_ID: sandbox.sandboxId,
          HOOK_BASE_URL: (process.env.HOOK_BASE_URL ??
            (process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : undefined))!,
          HOOK_AUTH_TOKEN: process.env.HOOK_AUTH_TOKEN!,
          BLOB_READ_WRITE_TOKEN: settings?.vercel_blob_storage_rw_token!,
          USER_ID: String(task?.user_id!),
          ...extractEnvs(process.env, /^(ANTHROPIC|CODEX)_/),
        },
      });

      await update(
        db,
        "vercel_sandbox",
        {
          status: `cmd:${command.cmdId}`,
          updated_at: new Date(),
        },
        {
          id: sandbox.sandboxId,
        },
      );
    } catch (e) {
      await update(
        db,
        "task_revision",
        {
          status: "failed",
          error: String((e as any)?.message ?? "Unknown error"),
        },
        {
          id: taskRevision.id,
        },
      );
      console.error(e);
    }
  });

  return await get(db, "task_revision", { id: taskRevision.id });
}

const filesToZip: Record<string, string[]> = {
  codex: [".codex"],
  claude: [".claude.json", ".claude"],
  "claude-opus": [".claude.json", ".claude"],
};

export async function getTaskRevisionCommandStatus(id: number) {
  try {
    const revision = await get(db, "task_revision", { id });
    const project = await get(db, "project", { id: revision.project_id });
    const dbSandbox = await get(db, "vercel_sandbox", {
      id: revision.vercel_sandbox_id!,
    });

    const sandbox = await Sandbox.get({
      sandboxId: dbSandbox.id,
      token: project.vercel_team_token,
      projectId: project.vercel_project_id,
      teamId: project.vercel_team_id,
    });

    if (!dbSandbox.status.startsWith("cmd:")) {
      console.error("not running cmd.");
      return null;
    }
    const cmdId = dbSandbox.status.split(":")[1];
    const _command = await sandbox.getCommand(cmdId);

    try {
      const command = await _command!.wait({
        signal: AbortSignal.timeout(5000),
      });

      // console.log(await command.wait())

      return {
        status:
          command.exitCode == null
            ? "running"
            : command.exitCode === 0
              ? "completed"
              : "failed",
        stdout: await command.stdout(),
        stderr: await command.stderr(),
        startedAt: command.startedAt,
      };
    } catch {
      return {
        status: "running",
        stdout: "",
        stderr: "",
        startedAt: _command.startedAt,
      };
    }
  } catch (e) {
    console.error(e);
    return null;
  }
}

const agentOptions: Record<string, string> = {
  claude: "--dangerously-skip-permissions -c",
  "claude-opus": "--dangerously-skip-permissions -c --model opus",
  codex: "--dangerously-bypass-approvals-and-sandbox",
};

export async function deployTask(
  projectId: number,
  taskId: number,
  taskRevisionId: number,
) {
  const project = await get(db, "project", { id: projectId });
  const task = await get(db, "task", { id: taskId });
  const taskRevision = await get(db, "task_revision", { id: taskRevisionId });
  const settings = await getSiteSettings();

  if (!taskRevision.git_commit_sha) {
    await update(
      db,
      "task_revision",
      {
        vercel_deployment_status: "ignored",
        vercel_deployment_error: "task revision not committed.",
      },
      { id: taskRevisionId },
    );
    throw new Error("task revision not committed.");
  }

  if (!taskRevision.tidbcloud_branch_id) {
    await update(
      db,
      "task_revision",
      {
        vercel_deployment_status: "ignored",
        vercel_deployment_error: "no connection info",
      },
      { id: taskRevisionId },
    );
    throw new Error("no connection info");
  }

  const branch = await get(db, "tidbcloud_branch", {
    id: taskRevision.tidbcloud_branch_id,
  });

  if (!branch.connection_url) {
    await update(
      db,
      "task_revision",
      {
        vercel_deployment_status: "ignored",
        vercel_deployment_error: "no connection info",
      },
      { id: taskRevisionId },
    );
    throw new Error("no connection info");
  }

  const vercel = new Vercel({
    bearerToken: project.vercel_team_token,
  });

  let env:
    | GetCustomEnvironmentResponseBody
    | CreateCustomEnvironmentResponseBody;

  try {
    env = await vercel.environment.getCustomEnvironment({
      teamId: project.vercel_team_id,
      idOrName: project.vercel_project_id,
      environmentSlugOrId: "codegen-tidb-ai-preview",
    });
  } catch (e) {
    try {
      env = await vercel.environment.createCustomEnvironment({
        teamId: project.vercel_team_id,
        idOrName: project.vercel_project_id,
        requestBody: {
          slug: "codegen-tidb-ai-preview",
          description: `This environment is used to deploy codes generated from codegen.tidb.ai. The environment variables will be updated before each deployment execution. do not add env variables to this project.`,
        },
      });
    } catch (e) {
      const errorMessage = `failed to create codegen-tidb-ai-preview environment. ${getErrorMessage(e)}`;
      await update(
        db,
        "task_revision",
        {
          vercel_deployment_status: "ignored",
          vercel_deployment_error: errorMessage,
        },
        { id: taskRevisionId },
      );
      throw new Error(errorMessage);
    }
  }

  try {
    await vercel.projects.createProjectEnv({
      teamId: project.vercel_team_id,
      idOrName: project.vercel_project_id,
      upsert: "true",
      requestBody: [
        {
          key: "DATABASE_URL",
          value: branch.connection_url,
          customEnvironmentIds: [env.id],
          target: [],
          type: "encrypted",
        },
        {
          key: "OPENAI_API_KEY",
          value: process.env.OPENAI_API_KEY ?? "",
          customEnvironmentIds: [env.id],
          target: [],
          type: "encrypted",
        },
      ],
    });
  } catch (e) {
    const errorMessage = `failed to setup codegen-tidb-ai-preview environment. ${getErrorMessage(e)}`;
    await update(
      db,
      "task_revision",
      {
        vercel_deployment_status: "ignored",
        vercel_deployment_error: errorMessage,
      },
      { id: taskRevisionId },
    );

    throw new Error(errorMessage);
  }

  try {
    const deployment = await vercel.deployments.createDeployment({
      forceNew: "1",
      teamId: project.vercel_team_id,
      requestBody: {
        name: project.github_repo,
        gitSource: {
          org: project.github_owner,
          repo: project.github_repo,
          ref: task.git_branch_name,
          sha: taskRevision.git_commit_sha,
          type: "github",
        },
        project: project.vercel_project_id,
        projectSettings: {
          nodeVersion: "24.x",
          serverlessFunctionRegion: "sin1",
          framework: "nextjs",
        },
        customEnvironmentSlugOrId: env.id,
      },
    });
    await update(
      db,
      "task_revision",
      {
        vercel_deployment_id: deployment.id,
      },
      { id: taskRevisionId },
    );

    return deployment;
  } catch (e) {
    const errorMessage = `Failed to deploy. ${getErrorMessage(e)}`;
    await update(
      db,
      "task_revision",
      {
        vercel_deployment_status: "failed",
        vercel_deployment_error: errorMessage,
      },
      { id: taskRevisionId },
    );
    throw new Error(errorMessage);
  }
}
