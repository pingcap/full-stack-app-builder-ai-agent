import type Stream from "node:stream";
import { type CommandFinished, Sandbox } from "@vercel/sandbox";
import type { CreateSandboxParams } from "@vercel/sandbox/dist/sandbox";
import type { Credentials } from "@vercel/sandbox/dist/utils/get-credentials";

export interface StartSandboxOptions
  extends Omit<CreateSandboxParams, "runtime"> {
  // This session is used to save and resume a development environment.
  session: string;
  blobId: string;
  gitBranch: string;
  gitRevision: string;
  stdout?: Stream.Writable;
  stderr?: Stream.Writable;
}

export type StartSandboxEvent =
  | {
      type: "created";
      sandbox: Sandbox;
    }
  | {
      type: "setup";
      cmdId: string;
      sandboxId: string;
    }
  | {
      type: "resume";
      cmdId: string;
      sandboxId: string;
    };

export async function* startSandbox({
  coding_agent_type,
  session,
  blobId,
  stdout,
  stderr,
  gitBranch,
  gitRevision,
  ...options
}: StartSandboxOptions &
  Credentials & {
    coding_agent_type: "codex" | "claude";
  }): AsyncGenerator<StartSandboxEvent> {
  const sandbox = await Sandbox.create({
    ...options,
    runtime: "node22",
  });

  yield { type: "created", sandbox };

  try {
    const setupScript = `set -e

${
  coding_agent_type === "codex"
    ? `
CODEX_CONFIG_TOML='model_provider = "crs"
model = "gpt-5.1-codex-max"
model_reasoning_effort = "high"
disable_response_storage = true
preferred_auth_method = "apikey"

[projects."/vercel/sandbox"]
trust_level = "trusted"

[model_providers.crs]
name = "crs"
base_url = "https://cr-tokyo.breeswish.org/openai"
wire_api = "responses"
requires_openai_auth = true
env_key = "CRS_OAI_KEY"
'

CODEX_AUTH_JSON='
{
  "OPENAI_API_KEY": null
}
'

echo Configuring Codex
mkdir -p ~/.codex
echo "$CODEX_CONFIG_TOML" > ~/.codex/config.toml
echo "$CODEX_AUTH_JSON" > ~/.codex/auth.json
`
    : ""
}

echo Installing tools
npm i -g ${coding_agent_type === "codex" ? "@openai/codex" : ""} ${coding_agent_type === "claude" ? "@openai/codex " : ""}code-tee vercel
${coding_agent_type === "claude" ? "curl -fsSL https://claude.ai/install.sh | bash" : ""}

echo Installing MCPs
${
  coding_agent_type === "codex"
    ? `
codex mcp add nextjs-devtools npx -y "next-devtools-mcp@latest"
codex mcp add playwright-devtools npx -y "@playwright/mcp@latest"
codex mcp add shadcn npx -y "shadcn@latest" "mcp"
`
    : ""
}
${
  coding_agent_type === "claude"
    ? `
claude mcp add nextjs-devtools npx -- -y "next-devtools-mcp@latest"
claude mcp add playwright-devtools npx -- -y "@playwright/mcp@latest"
claude mcp add shadcn npx -- -y "shadcn@latest" "mcp"
`
    : ""
}


PACKAGE_JSON="$(npm prefix)/package.json"

if [ -f "$PACKAGE_JSON" ]; then
  echo package.json found, installing dependencies
  # TODO check package manager
  npm ci
fi

`;

    const resumeScript = `
set -e
cd ~

echo Try to recovering ${coding_agent_type} history...

ret=0
wget "$BLOB_PUBLIC_URL/${coding_agent_type}-sessions/$USER_ID/$SANDBOX_SESSION_ID/${coding_agent_type}-data.zip" 2>/dev/null || ret=$?

if [ $ret -eq 0 ]; then
  echo Decompressing previous session files...
  unzip -o ${coding_agent_type}-data.zip
  rm ${coding_agent_type}-data.zip
fi


cd /vercel/sandbox
echo Checking out branch...

echo git branch -f "$GIT_BRANCH" "$GIT_REVISION"
git branch -f "$GIT_BRANCH" "$GIT_REVISION"

echo git checkout "$GIT_BRANCH"
git checkout "$GIT_BRANCH"

echo git clean -fx
git clean -fx
`;

    await assertCommandSuccess(
      sandbox.runCommand({
        cmd: "dnf",
        args: ["install", "-y", "wget", "zip", "unzip", "jq"],
        sudo: true,
      }),
    );

    const setupCommand = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", setupScript],
      stdout,
      stderr,
      detached: true,
    });
    yield {
      type: "setup",
      cmdId: setupCommand.cmdId,
      sandboxId: sandbox.sandboxId,
    };
    await assertCommandSuccess(setupCommand.wait());

    const resumeCommand = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", resumeScript],
      env: {
        SANDBOX_SESSION_ID: session,
        BLOB_PUBLIC_URL: `https://${blobId.replace(/^store_/, "")}.public.blob.vercel-storage.com`,
        GIT_BRANCH: gitBranch,
        GIT_REVISION: gitRevision,
      },
      stdout,
      stderr,
      detached: true,
    });
    yield {
      type: "resume",
      cmdId: resumeCommand.cmdId,
      sandboxId: sandbox.sandboxId,
    };

    await assertCommandSuccess(resumeCommand.wait());
  } catch (e) {
    await sandbox.stop();
    throw e;
  }
}

async function assertCommandSuccess(commandPromise: Promise<CommandFinished>) {
  const command = await commandPromise;
  if (command.exitCode === 0) {
    return;
  } else {
    throw new Error(
      `Command failed with exit code ${command.exitCode}: ${await command.stderr()}`,
    );
  }
}
