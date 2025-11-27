import { validateGitHubToken } from "@/actions/user-settings";
import { GithubAccountSettings } from "@/components/github-account-settings";
import { getSessionUserSettings } from "@/lib/auth";

export default async function Page() {
  const settings = await getSessionUserSettings();
  const result = await validateGitHubToken(undefined);

  return (
    <GithubAccountSettings
      tokenExists={settings?.github_token !== null}
      tokenErased={settings?.github_token?.slice(0, 6).padEnd(12, "*")}
      initialValidationResult={result}
    />
  );
}
