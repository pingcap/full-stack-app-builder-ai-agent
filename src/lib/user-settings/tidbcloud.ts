import type { DB } from "@/lib/db/schema";
import type { Selectable } from "kysely";

export function isTiDBCloudSettingsValid(
  settings: Selectable<DB["user_setting"]> | undefined | null,
): settings is Selectable<DB["user_setting"]> & {
  tidbcloud_public_key: string;
  tidbcloud_private_key: string;
  tidbcloud_organization_id: string;
  tidbcloud_project_id: string;
} {
  return (
    settings?.tidbcloud_public_key != null &&
    settings.tidbcloud_private_key != null &&
    settings.tidbcloud_organization_id != null &&
    settings.tidbcloud_project_id != null
  );
}
