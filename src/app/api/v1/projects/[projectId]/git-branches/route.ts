import { getSessionUserSettings } from "@/lib/auth";
import db from "@/lib/db/db";
import { get } from "@/lib/kysely-utils";
import {
  getGitHubClient,
  isGitHubSettingsValid,
} from "@/lib/user-settings/github";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const projectId = parseInt(decodeURIComponent((await params).projectId));
  const settings = await getSessionUserSettings();

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
    user_id: settings.user_id,
  });

  const { data: branches } = await getGitHubClient(
    settings.github_token,
  ).rest.repos.listBranches({
    owner: project.github_owner,
    repo: project.github_repo,
  });

  return NextResponse.json(branches);
}
