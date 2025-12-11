import { validateTidbCloudAccessKey } from "@/actions/user-settings";
import { TidbCloudAccountSettings } from "@/components/tidbcloud-account-settings";

import { getSiteSettings } from "@/lib/system-settings";

export default async function Page() {
  const settings = await getSiteSettings();
  const result = await validateTidbCloudAccessKey(
    settings?.tidbcloud_public_key,
    settings?.tidbcloud_private_key,
  );

  return (
    <TidbCloudAccountSettings
      initialInfo={result}
      publicKeyErased={settings?.tidbcloud_public_key
        ?.slice(0, 4)
        .padEnd(12, "*")}
      privateKeyErased={settings?.tidbcloud_private_key
        ?.slice(0, 4)
        .padEnd(12, "*")}
      orgId={settings?.tidbcloud_organization_id}
      projectId={settings?.tidbcloud_project_id}
    />
  );
}
