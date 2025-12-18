import type { DB } from "@/lib/db/schema";
import type { SiteSettings } from "@/lib/system-settings";
import { tidbCloudFetch } from "@/lib/tidbcloud/fetch";

export interface CreateClusterParams {
  displayName: string;
  rootPassword?: string;
}

export interface CreateBranchParams {
  clusterId: string;
  displayName: string;
  rootPassword?: string;
  parentId?: string;
}

export interface ClusterInfo {
  name: string;
  clusterId: string;
  displayName: string;
  userPrefix: string;
  state: "CREATING" | "ACTIVE" | "DELETED" | "RESTORING";
}

export interface BranchInfo {
  name: string;
  branchId: string;
  displayName: string;
  clusterId: string;
  state: "CREATING" | "ACTIVE" | "DELETED" | "RESTORING";
  userPrefix: string;
}

export interface AccessKeyInfo {
  name: `orgs/${string}/projects/${string}/apiKeys/${string}`;
  accessKey: string;
  secretKey: string;
  displayName: string;
  role: "project:owner";
}

export type TiDBCloudSettings = {
  [P in keyof SiteSettings & `tidbcloud_${string}`]: string;
};

export async function getAccessKeyInfo(
  publicKey: string,
  privateKey: string,
): Promise<AccessKeyInfo> {
  const response = await tidbCloudFetch(
    `https://iam.tidbapi.com/v1beta1/apikeys/${publicKey}`,
    {
      method: "GET",
      digest: { username: publicKey, password: privateKey },
    },
  );

  return await response.json();
}

export async function createCluster(
  { displayName, rootPassword }: CreateClusterParams,
  settings: TiDBCloudSettings,
): Promise<ClusterInfo> {
  const response = await tidbCloudFetch(
    "https://serverless.tidbapi.com/v1beta1/clusters",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName,
        rootPassword,
        region: {
          name: process.env.TIDB_CLOUD_REGION!,
        },
        spendingLimit: {
          monthly: process.env.TIDB_CLOUD_FREE_TIER === '1' ? 0 : 1000,
        },
        labels: {
          "tidb.cloud/organization": settings.tidbcloud_organization_id,
          "tidb.cloud/project": settings.tidbcloud_project_id,
        },
      }),
      digest: {
        username: settings.tidbcloud_public_key,
        password: settings.tidbcloud_private_key,
      },
    },
  ).then(handleError);

  return await response.json();
}

export async function getCluster(
  clusterId: string,
  settings: TiDBCloudSettings,
): Promise<ClusterInfo> {
  const response = await tidbCloudFetch(
    `https://serverless.tidbapi.com/v1beta1/clusters/${clusterId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      digest: {
        username: settings.tidbcloud_public_key,
        password: settings.tidbcloud_private_key,
      },
    },
  ).then(handleError);

  return await response.json();
}

export async function deleteCluster(
  clusterId: string,
  settings: TiDBCloudSettings,
): Promise<any> {
  const response = await tidbCloudFetch(
    `https://serverless.tidbapi.com/v1beta1/clusters/${clusterId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      digest: {
        username: settings.tidbcloud_public_key,
        password: settings.tidbcloud_private_key,
      },
    },
  ).then(handleError);

  return await response.json();
}

export async function createBranch(
  { displayName, clusterId, rootPassword, parentId }: CreateBranchParams,
  settings: TiDBCloudSettings,
): Promise<BranchInfo> {
  const response = await tidbCloudFetch(
    `https://serverless.tidbapi.com/v1beta1/clusters/${clusterId}/branches`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName,
        parentId,
        rootPassword,
      }),
      digest: {
        username: settings.tidbcloud_public_key,
        password: settings.tidbcloud_private_key,
      },
    },
  ).then(handleError);

  return await response.json();
}

export async function getBranch(
  clusterId: string,
  branchId: string,
  settings: TiDBCloudSettings,
): Promise<BranchInfo> {
  const response = await tidbCloudFetch(
    `https://serverless.tidbapi.com/v1beta1/clusters/${clusterId}/branches/${branchId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      digest: {
        username: settings.tidbcloud_public_key,
        password: settings.tidbcloud_private_key,
      },
    },
  ).then(handleError);

  return await response.json();
}

export async function listBranches(
  clusterId: string,
  settings: TiDBCloudSettings,
): Promise<BranchInfo[]> {
  const response = await tidbCloudFetch(
    `https://serverless.tidbapi.com/v1beta1/clusters/${clusterId}/branches`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      digest: {
        username: settings.tidbcloud_public_key,
        password: settings.tidbcloud_private_key,
      },
    },
  ).then(handleError);

  const data = await response.json();
  if (Array.isArray(data?.branches)) {
    return data.branches;
  }
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}

const handleError = async (response: Response | Promise<Response>) => {
  response = await response;
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  return response;
};
