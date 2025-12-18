import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db/db';
import { cache } from 'react';
import { z } from 'zod';

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const siteSettingsSchema = z.object({
  github_login: z.string().optional(),
  github_token: z.string().optional(),
  tidbcloud_public_key: z.string().optional(),
  tidbcloud_private_key: z.string().optional(),
  tidbcloud_organization_id: z.string().optional(),
  tidbcloud_project_id: z.string().optional(),
  vercel_token: z.string().optional(),
  vercel_blob_team_id: z.string().optional(),
  vercel_blob_storage_id: z.string().optional(),
  vercel_blob_storage_rw_token: z.string().optional(),
  default_vercel_project_team_id: z.string().optional(),
});

export async function updateSiteSettings (settings: Partial<SiteSettings>) {
  await db.insertInto('system_settings')
    .values(Object.entries(settings).map(([key, v]) => ({
      key,
      value: JSON.stringify(v),
    })))
    .onDuplicateKeyUpdate({
      value: eb => eb.fn('VALUES', ['value']),
    })
    .execute();
}

async function $readSiteSettings () {
  const { settings } = await db
    .selectFrom('system_settings')
    .select((eb) =>
      eb
        .fn('ifnull', [
          eb.fn('json_objectagg', ['key', 'value']),
          eb.fn('json_object', []),
        ])
        .$castTo<object>()
        .as('settings'),
    )
    .executeTakeFirstOrThrow();

  return siteSettingsSchema.parse(settings);
}

async function $getSiteSettings () {
  const user = await getSessionUser();
  if (user) {
    return await $readSiteSettings();
  }
  return {} as SiteSettings;
}

export const getSiteSettings = cache($getSiteSettings);
