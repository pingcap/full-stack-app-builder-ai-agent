import { validateVercelToken } from "@/actions/user-settings";
import { VercelBlobStorageSetup } from "@/components/vercel-blob-storage-setup";
import { VercelDefaultProjectTeamSetup } from "@/components/vercel-default-project-team-setup";
import { VercelTokenSetup } from "@/components/vercel-token-setup";

import { getSiteSettings } from "@/lib/system-settings";

export default async function Page() {
  const settings = await getSiteSettings();
  const result = await validateVercelToken(settings?.vercel_token);

  return (
    <div className="space-y-12">
      <VercelTokenSetup
        tokenExists={settings?.vercel_token !== null}
        tokenErased={settings?.vercel_token?.slice(0, 6).padEnd(12, "*")}
        initialValidationResult={result}
      />
      <VercelBlobStorageSetup
        enabled={typeof result === "object"}
        vercelBlobTeamId={settings?.vercel_blob_team_id ?? undefined}
        vercelBlobId={settings?.vercel_blob_storage_id ?? undefined}
      />
      <VercelDefaultProjectTeamSetup
        enabled={typeof result === "object"}
        defaultVercelTeamId={
          settings?.default_vercel_project_team_id ?? undefined
        }
      />
    </div>
  );
}
