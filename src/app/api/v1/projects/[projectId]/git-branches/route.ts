import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/db";
import { get } from "@/lib/kysely-utils";
import { getSiteSettings } from "@/lib/system-settings";
import {
  getGitHubClient,
  isGitHubSettingsValid,
} from "@/lib/user-settings/github";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const projectId = parseInt(decodeURIComponent((await params).projectId));
  const settings = await getSiteSettings();

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
  });

  const { data: branches } = await getGitHubClient(
    settings.github_token,
  ).rest.repos.listBranches({
    owner: project.github_owner,
    repo: project.github_repo,
  });

  return NextResponse.json(branches);
}
