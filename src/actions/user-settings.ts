"use server";

import type { Endpoints } from "@octokit/types";
import type { AuthUser } from "@vercel/sdk/models/authuser";
import type { AuthUserLimited } from "@vercel/sdk/models/authuserlimited";
import { refresh } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { getSiteSettings, updateSiteSettings } from "@/lib/system-settings";
import { type AccessKeyInfo, getAccessKeyInfo } from "@/lib/tidbcloud/sdk";
import {
  getGitHubClient,
  isGitHubSettingsValid,
} from "@/lib/user-settings/github";
import { getVercelClient } from "@/lib/user-settings/vercel";
import { getBlobStorageReadWriteToken } from "@/lib/vercel/blobs";

export type GithubUserResponse = Endpoints["GET /user"]["response"]["data"];

export async function setGithubToken(formData: FormData) {
  const token = formData.get("github_token");

  if (typeof token !== "string") {
    return "No token provided.";
  }

  const user = await getSessionUser();

  if (!user) {
    return "User not found.";
  }

  const result = await validateGitHubToken(token);

  if (typeof result === "string") {
    return result;
  }

  await updateSiteSettings({
    github_token: token,
    github_login: result.login,
  });

  refresh();

  return result;
}

export async function setVercelToken(formData: FormData) {
  const token = formData.get("vercel_token");

  if (typeof token !== "string") {
    return "No token provided.";
  }

  const user = await getSessionUser();

  if (!user) {
    return "User not found.";
  }

  const result = await validateVercelToken(token);

  if (typeof result === "string") {
    return result;
  }

  await updateSiteSettings({
    vercel_token: token,
  });

  refresh();

  return result;
}

export async function setVercelBlobStorage(formData: FormData) {
  const user = await getSessionUser();

  if (!user) {
    return "User not found.";
  }

  const vercel_blob_team_id = formData.get("vercel_blob_team_id");
  const vercel_blob_storage_id = formData.get("vercel_blob_storage_id");
  if (
    typeof vercel_blob_team_id !== "string" ||
    typeof vercel_blob_storage_id !== "string"
  ) {
    return "Invalid input.";
  }

  const { token: rwToken } = await getBlobStorageReadWriteToken(
    vercel_blob_team_id,
    vercel_blob_storage_id,
  );

  await updateSiteSettings({
    vercel_blob_team_id,
    vercel_blob_storage_id,
    vercel_blob_storage_rw_token: rwToken,
  });

  refresh();
}

export async function setVercelDefaultProjectTeam(formData: FormData) {
  const user = await getSessionUser();

  if (!user) {
    return "User not found.";
  }

  const default_vercel_project_team_id = formData.get(
    "default_vercel_project_team_id",
  );
  if (typeof default_vercel_project_team_id !== "string") {
    return "Invalid input.";
  }

  await updateSiteSettings({
    default_vercel_project_team_id,
  });

  refresh();
}

export async function setTidbCloudAccessKey(formData: FormData) {
  const user = await getSessionUser();

  if (!user) {
    return "User not found.";
  }

  const tidbcloud_public_key = formData.get("tidbcloud_public_key");
  const tidbcloud_private_key = formData.get("tidbcloud_private_key");

  if (
    typeof tidbcloud_public_key !== "string" ||
    typeof tidbcloud_private_key !== "string"
  ) {
    return "Invalid input.";
  }

  const result = await validateTidbCloudAccessKey(
    tidbcloud_public_key,
    tidbcloud_private_key,
  );
  if (typeof result === "string") {
    return result;
  }

  const NAME_REGEX = /^orgs\/(.+)\/projects\/(.+)\/apiKeys\/.+$/;
  const matched = NAME_REGEX.exec(result.name);

  if (!matched) {
    return "Invalid key";
  }

  const [_, orgId, projectId] = matched;

  await updateSiteSettings({
    tidbcloud_public_key,
    tidbcloud_private_key,
    tidbcloud_organization_id: orgId,
    tidbcloud_project_id: projectId,
  });

  refresh();

  return result;
}

export async function validateGitHubToken(
  token?: string | undefined | null,
): Promise<GithubUserResponse | string> {
  if (!token) {
    const sessionUserSettings = await getSiteSettings();

    if (isGitHubSettingsValid(sessionUserSettings)) {
      token = sessionUserSettings.github_token;
    }
  }

  if (!token) {
    return "No token provided.";
  }

  try {
    const octokit = getGitHubClient(token);
    const { data: user } = await octokit.rest.users.getAuthenticated();
    return user;
  } catch (e) {
    return getErrorMessage(e);
  }
}

export async function validateVercelToken(
  token?: string | undefined | null,
): Promise<AuthUser | AuthUserLimited | string> {
  if (!token) {
    const sessionUserSettings = await getSiteSettings();

    if (isGitHubSettingsValid(sessionUserSettings)) {
      token = sessionUserSettings.vercel_token;
    }
  }

  if (!token) {
    return "No token provided.";
  }

  const vercel = getVercelClient(token);
  try {
    const { user } = await vercel.user.getAuthUser();

    return user;
  } catch (e) {
    return getErrorMessage(e);
  }
}

export async function validateTidbCloudAccessKey(
  publicKey?: string | undefined | null,
  privateKey?: string | undefined | null,
): Promise<AccessKeyInfo | string> {
  if (!publicKey && !privateKey) {
    const settings = await getSiteSettings();
    publicKey = settings?.tidbcloud_public_key;
    privateKey = settings?.tidbcloud_private_key;
  }

  if (!publicKey || !privateKey) {
    return "No access key provided.";
  }
  try {
    const info = await getAccessKeyInfo(publicKey, privateKey);

    if (info.role !== "project:owner") {
      return "Access key does not have project:owner role.";
    }

    return info;
  } catch (e) {
    return getErrorMessage(e);
  }
}
