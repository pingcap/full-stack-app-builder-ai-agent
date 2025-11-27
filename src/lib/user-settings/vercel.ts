import type { DB } from "@/lib/db/schema";
import { Vercel } from "@vercel/sdk";
import type { Selectable } from "kysely";
import { cache } from "react";

export function isVercelSettingsValid(
  settings: Selectable<DB["user_setting"]> | undefined | null,
): settings is Selectable<DB["user_setting"]> & {
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
