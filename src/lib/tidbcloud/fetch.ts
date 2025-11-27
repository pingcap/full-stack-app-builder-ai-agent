import { wrapFetchWithDigestFlow } from "@/lib/tidbcloud/digest-auth";

export const tidbCloudFetch = wrapFetchWithDigestFlow(fetch);
