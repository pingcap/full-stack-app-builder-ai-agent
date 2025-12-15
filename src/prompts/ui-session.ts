import type { LanguageModelV3 } from "@ai-sdk/provider";
import {
  generateObject,
  type InferUIMessageChunk,
  type UIDataTypes,
  type UIMessage,
  type UIMessagePart,
} from "ai";
import { z } from "zod";
import { openai } from "@/lib/llm/models";

const system = `User is create a project to implement some features.

The workflow is:
1. create a project <-- this is the current step
   - create github reposition: the repo is created from a public github template
   - create vercel project for deployment
   - create tidbcloud serverless cluster as database
2. create first task (like a dev branch in git era)
3. send first task prompt
   - will create a tidbcloud cluster branch and setup env variables in env file
   - will run coding agent (like codex, claude code to write codes)
   - will commit to the working branch when finished

Help user to generate the meta fields and first prompt:
- This prompt will be sent to a coding agent like claude code or codex.
- Do not make a specific plan for generic job, let agent decide what to do.
- Code agent can fetch URL content, let agent fetch URL if needed.
- Make sure the coding agent will write and **execute the migration sql** if database features will be used
- Database is TiDB Cloud (MySQL-compatible). Use MySQL/TiDB grammar and avoid Postgres-only SQL (e.g. \`RETURNING\`).
- Do not use specific tech stack, agent needs to find it in the repository structure
- \`npm run dev\` is running, the dev port is 3000.
- Do not read file .env.local, it containers secret environment variables:
  - DATABASE_URL: the database connection url of TiDBCloud Cluster
  - OPENAI_API_KEY: the OpenAI API key to access OpenAI API
- Append original user prompt to the end to prevent misunderstanding.
- MCP Tools available, use if needed:
  - nextjs devtools mcp - if you want to use it, read https://nextjs.org/docs/app/guides/mcp for more details
  - shadcn mcp tools to get shadcn/ui registries and component examples if you are confused.
`;

const defaultModel = openai("gpt-5.1");

export type UISessionStep1Info = Awaited<
  ReturnType<typeof generateUISessionStep1>
>;
export type UISessionStep2Info = Awaited<
  ReturnType<typeof generateUISessionStep2>
>;

export type UISessionStep3Info = Awaited<
  ReturnType<typeof generateUISessionStep3>
>;

export async function generateUISessionStep1({
  userPrompt,
  model = defaultModel,
}: {
  userPrompt: string;
  model?: LanguageModelV3;
}) {
  const { object } = await generateObject({
    system,
    model,
    schema: z.object({
      slug: z
        .string()
        .min(4)
        .max(32)
        .describe(
          "The url slug for this project, (4~32 characters) use kebab-case",
        ),
      title: z.string().describe("The title of this project"),
    }),
    messages: [{ role: "user", content: userPrompt }],
  });

  return object;
}

export async function generateUISessionStep2({
  userPrompt,
  step1,
  model = defaultModel,
}: {
  userPrompt: string;
  step1: UISessionStep1Info;
  model?: LanguageModelV3;
}) {
  const { object } = await generateObject({
    system,
    model,
    schema: z.object({
      project_name: z.string().describe("use kebab-case"),
      first_task_name: z.string().describe("use kebab-case"),
      first_task_branch_name: z.string().describe("use kebab-case"),
      github_repository_name: z
        .string()
        .min(4)
        .max(32)
        .describe("use kebab-case"),
      vercel_project_name: z
        .string()
        .min(4)
        .max(32)
        .describe("4~32 characters, use kebab-case"),
      tidbcloud_cluster_name: z
        .string()
        .describe("The new Vercel project name. use kebab-case"),
    }),
    messages: [
      { role: "user", content: userPrompt },
      { role: "assistant", content: JSON.stringify(step1, undefined, 2) },
      { role: "user", content: "Please generate more fields for me." },
    ],
  });

  return object;
}

export async function generateUISessionStep3({
  userPrompt,
  step1,
  step2,
  model = defaultModel,
}: {
  userPrompt: string;
  step1: UISessionStep1Info;
  step2: UISessionStep2Info;
  model?: LanguageModelV3;
}) {
  const { object } = await generateObject({
    system,
    model,
    schema: z.object({
      prompt: z.string(),
    }),
    messages: [
      { role: "user", content: userPrompt },
      { role: "assistant", content: JSON.stringify(step1, undefined, 2) },
      { role: "user", content: "Please generate more fields for me." },
      { role: "assistant", content: JSON.stringify(step2, undefined, 2) },
      { role: "user", content: `Please generate first prompt for me.` },
    ],
  });

  return object;
}

export type UISessionMessage = UIMessage<
  unknown,
  UIDataTypes,
  UISessionMessageTools
>;
export type UISessionMessagePart = UIMessagePart<
  UIDataTypes,
  UISessionMessageTools
>;
export type UISessionMessageChunk = InferUIMessageChunk<UISessionMessage>;

export type UISessionMessageTools = {
  "generate-meta-fields": {
    input: undefined;
    output: UISessionStep2Info;
  };
  "create-tidbcloud-cluster": {
    input: Pick<UISessionStep2Info, "tidbcloud_cluster_name">;
    output: undefined;
  };
  "create-vercel-project": {
    input: Pick<UISessionStep2Info, "vercel_project_name">;
    output: undefined;
  };
  "create-github-repo": {
    input: {
      owner: string;
      name: string;
    };
    output: undefined;
  };
  "generate-first-prompt": {
    input: undefined;
    output: UISessionStep3Info;
  };
  "detect-user-intent": {
    input: undefined;
    output: UISessionStep3Info;
  };
};
