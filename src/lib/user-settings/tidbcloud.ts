import type { SiteSettings } from '@/lib/system-settings';

export function isTiDBCloudSettingsValid (
  settings: SiteSettings | undefined | null,
): settings is SiteSettings & {
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
