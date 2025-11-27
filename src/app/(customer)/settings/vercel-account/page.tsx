import { validateVercelToken } from "@/actions/user-settings";
import { VercelBlobStorageSelect } from "@/components/vercel-blob-storage-select";
import { VercelTokenSetup } from "@/components/vercel-token-setup";
import { getSessionUserSettings } from "@/lib/auth";

export default async function Page() {
  const settings = await getSessionUserSettings();
  const result = await validateVercelToken(settings?.vercel_token);

  return (
    <div className="space-y-12">
      <VercelTokenSetup
        tokenExists={settings?.vercel_token !== null}
        tokenErased={settings?.vercel_token?.slice(0, 6).padEnd(12, "*")}
        initialValidationResult={result}
      />
      <VercelBlobStorageSelect
        enabled={typeof result === "object"}
        vercelBlobTeamId={settings?.vercel_blob_team_id ?? undefined}
        vercelBlobId={settings?.vercel_blob_storage_id ?? undefined}
      />
    </div>
  );
}
