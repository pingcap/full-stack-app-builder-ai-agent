import { generateObject } from "ai";
import { kebabCase } from "change-case";
import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createProject } from "@/actions/projects";
import { createTaskRevision } from "@/actions/task-revisions";
import { createTask } from "@/actions/tasks";
import { getSessionUserSettings } from "@/lib/auth";
import db from "@/lib/db/db";
import { get, insert } from "@/lib/kysely-utils";
import { openai } from "@/lib/llm/models";
import {
  getGitHubClient,
  isGitHubSettingsValid,
} from "@/lib/user-settings/github";

const requestSchema = z.object({
  first_prompt: z.string(),
  coding_agent_type: z.enum(["codex", "claude"]),
});

export type CreateSessionResult = ReturnType<typeof POST> extends Promise<
  NextResponse<infer U>
>
  ? U
  : never;

export async function POST(request: NextRequest) {
  const { first_prompt, coding_agent_type } = requestSchema.parse(
    await request.json(),
  );
  const suffix = Math.random().toString(36).substring(2, 6);
  const settings = await getSessionUserSettings();

  if (!isGitHubSettingsValid(settings)) {
    return NextResponse.json<never>(
      {
        message: "GitHub settings are invalid.",
      } as never,
      { status: 400 },
    );
  }
  if (!settings?.default_vercel_project_team_id) {
    return NextResponse.json<never>(
      {
        message: "Default Vercel project team id is not set.",
      } as never,
      { status: 400 },
    );
  }

  const {
    object: {
      github_repository_name,
      project_name,
      first_task_name,
      first_task_branch_name,
      prompt,
      slug,
      tidbcloud_cluster_name,
      vercel_project_name,
    },
  } = await generateObject({
    system: `User is create a project to implement some features.

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

Help user to generate the prompt:
- Make sure the coding agent will write and **execute the migration sql** if database features will be used
- Do not use specific tech stack, agent needs to find it in the repository structure
- \`npm run dev\` is running, the dev port is 3000. and do not run \`npm run build\` command which may break dev preview page

Help user to generate meta fields, use kebab case.

`,
    model: openai("gpt-5.1"),
    schema: z.object({
      slug: z.string().describe("The url slug for this project"),
      project_name: z.string(),
      first_task_name: z.string(),
      first_task_branch_name: z.string(),
      github_repository_name: z.string(),
      vercel_project_name: z.string(),
      tidbcloud_cluster_name: z
        .string()
        .describe("The new Vercel project name."),
      prompt: z.string(),
    }),
    messages: [{ role: "user", content: first_prompt }],
  });

  const project = await createProject({
    name: `${kebabCase(project_name)}-${suffix}`,
    description: "",
    vercel_team_id: settings?.default_vercel_project_team_id!,
    github_repository_name: `${github_repository_name}-${suffix}`,
    tidbcloud_cluster_name: `${tidbcloud_cluster_name}-${suffix}`,
    vercel_project_name: `${vercel_project_name}-${suffix}`,
    coding_agent_type,
    auto_deployment: 1,
  });

  const octokit = getGitHubClient(settings.github_token);

  const branch = await octokit.rest.repos.getBranch({
    repo: project.github_repo,
    owner: project.github_owner,
    branch: "main",
  });

  const task = await createTask({
    name: first_task_name,
    git_branch_name: first_task_branch_name,
    git_revision_ref: branch.data.commit.sha,
    project_id: project.id,
    parent_task_id: null,
    parent_task_revision_ordinal: null,
    user_id: project.user_id,
  });

  after(async () => {
    while (true) {
      const proj = await get(db, "project", { id: project.id });
      if (proj.status === "ready") break;
    }

    await createTaskRevision({
      sandbox_type: project.coding_agent_type as never,
      task_id: task.id,
      prompt,
      user_prompt: first_prompt,
    });
  });

  const uiSession = await insert(db, "ui_session", {
    slug: `${slug}-${suffix}`,
    project_id: project.id,
    task_id: task.id,
    user_id: settings.user_id,
    created_at: new Date(),
    updated_at: new Date(),
  });

  return NextResponse.json(uiSession);
}
