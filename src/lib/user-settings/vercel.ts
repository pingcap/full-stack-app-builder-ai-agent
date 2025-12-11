import { Vercel } from "@vercel/sdk";
import { cache } from "react";
import type { SiteSettings } from "@/lib/system-settings";

export function isVercelSettingsValid(
  settings: SiteSettings | undefined | null,
): settings is SiteSettings & {
  vercel_token: string;
  vercel_blob_team_id: string;
  vercel_blob_storage_id: string;
  vercel_blob_storage_rw_token: string;
} {
  return (
    settings?.vercel_token != null &&
    settings.vercel_blob_team_id != null &&
    settings.vercel_blob_storage_id != null &&
    settings.vercel_blob_storage_rw_token != null
  );
}

export const getVercelClient = cache((token: string) => {
  return new Vercel({ bearerToken: token });
});
