import { unauthorized } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTaskRevision } from "@/actions/task-revisions";
import { createTask } from "@/actions/tasks";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db/db";
import { get } from "@/lib/kysely-utils";
import { getSiteSettings } from "@/lib/system-settings";
import {
  getGitHubClient,
  isGitHubSettingsValid,
} from "@/lib/user-settings/github";

const requestSchema = z.object({
  name: z.string(),
  base_branch: z.string().optional().default("main"),
  target_branch: z.string(),
  first_prompt: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const projectId = parseInt(decodeURIComponent((await params).projectId));
  const user = await getSessionUser();
  const settings = await getSiteSettings();

  if (!user) {
    unauthorized();
  }

  if (!settings) {
    return NextResponse.json(
      {
        message: "Invalid user.",
      },
      {
        status: 400,
      },
    );
  }

  if (!isGitHubSettingsValid(settings)) {
    return NextResponse.json(
      {
        message: "GitHub settings are invalid.",
      },
      {
        status: 400,
      },
    );
  }

  const project = await get(db, "project", {
    id: projectId,
    user_id: user.id,
  });

  const octokit = getGitHubClient(settings.github_token);

  const { name, base_branch, target_branch, first_prompt } =
    requestSchema.parse(await request.json());

  const branch = await octokit.rest.repos.getBranch({
    repo: project.github_repo,
    owner: project.github_owner,
    branch: base_branch,
  });

  const task = await createTask({
    project_id: projectId,
    name,
    user_id: project.user_id,
    git_revision_ref: branch.data.commit.sha,
    git_branch_name: target_branch,
  });

  if (first_prompt) {
    await createTaskRevision({
      task_id: task.id,
      sandbox_type: project.coding_agent_type as never,
      prompt: first_prompt,
      user_prompt: first_prompt,
    });
  }

  return NextResponse.json(task);
}
