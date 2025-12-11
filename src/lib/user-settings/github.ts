import type { Selectable } from "kysely";
import { Octokit } from "octokit";
import { cache } from "react";
import type { DB } from "@/lib/db/schema";
import type { SiteSettings } from "@/lib/system-settings";

export const getGitHubClient = cache((token: string) => {
  return new Octokit({ auth: token });
});

export function isGitHubSettingsValid(
  settings: SiteSettings,
): settings is SiteSettings & {
  github_token: string;
  github_login: string;
} {
  return settings?.github_token != null;
}

export function getUserGitHubClient(settings: SiteSettings) {
  if (!isGitHubSettingsValid(settings)) {
    throw new Error("Invalid GitHub settings");
  }

  return getGitHubClient(settings.github_token);
}
