import { handleVercelApiCallError } from "@/lib/vercel/errors";
import { getValidSessionUserVercelToken } from "@/lib/vercel/utils";

export interface VercelBlobStorageDetails {
  id: string;
  onwerId: string;
  createdAt: number;
  updatedAt: number;
  type: "blob";
  name: string;
  status: string; // available
}

export async function listBlobStorages(
  teamId: string,
): Promise<VercelBlobStorageDetails[]> {
  const token = await getValidSessionUserVercelToken();
  if (!token) {
    throw new Error("No valid session user vercel token found");
  }

  const response = await fetch(
    `https://api.vercel.com/v1/storage/stores?teamId=${encodeURIComponent(teamId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  ).then(handleVercelApiCallError);

  const data = await response.json();

  return data.stores.filter(
    (store: VercelBlobStorageDetails) => store.type === "blob",
  );
}

export async function getBlobStorageReadWriteToken(
  teamId: string,
  blobId: string,
): Promise<{ token: string }> {
  const token = await getValidSessionUserVercelToken();
  if (!token) {
    throw new Error("No valid session user vercel token found");
  }

  const response = await fetch(
    `https://api.vercel.com/v1/storage/stores/${blobId}/secrets?teamId=${encodeURIComponent(teamId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  ).then(handleVercelApiCallError);

  const { rwToken } = await response.json();

  return {
    token: rwToken,
  };
}
