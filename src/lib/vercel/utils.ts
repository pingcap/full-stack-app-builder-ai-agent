import type { Pagination } from "@vercel/sdk/models/pagination";
import { getSiteSettings } from "@/lib/system-settings";

export async function getValidSessionUserVercelToken() {
  const userSettings = await getSiteSettings();

  return userSettings?.vercel_token;
}

export async function getAllPages<Key extends string, T>(
  fn: (q: {
    limit?: number;
    since?: number;
  }) => Promise<{ pagination: Pagination } & { [P in Key]: T[] }>,
  key: Key,
) {
  let since: number | undefined;
  const limit = 100;
  const results: T[] = [];

  while (true) {
    const page = await fn({
      limit,
      since,
    });

    page[key].forEach((result) => {
      results.push(result);
    });
    if (page.pagination.next == null) return results;
    since = page.pagination.next;
  }

  return results;
}
