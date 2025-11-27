import type { DB } from "@/lib/db/schema";
import type { Selectable } from "kysely";
import { Octokit } from "octokit";
import { cache } from "react";

export const getGitHubClient = cache((token: string) => {
  return new Octokit({ auth: token });
});

export function isGitHubSettingsValid(
  settings: Selectable<DB["user_setting"]> | undefined | null,
): settings is Selectable<DB["user_setting"]> & {
  github_token: string;
  github_login: string;
} {
  return settings?.github_token != null;
}

export function getUserGitHubClient(settings: Selectable<DB["user_setting"]>) {
  if (!isGitHubSettingsValid(settings)) {
    throw new Error("Invalid GitHub settings");
  }

  return getGitHubClient(settings.github_token);
}
