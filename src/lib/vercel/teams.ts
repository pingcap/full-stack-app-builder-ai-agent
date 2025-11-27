import { getVercelClient } from "@/lib/user-settings/vercel";
import {
  getAllPages,
  getValidSessionUserVercelToken,
} from "@/lib/vercel/utils";

export async function listTeams() {
  const token = await getValidSessionUserVercelToken();
  if (!token) {
    throw new Error("No valid session user vercel token found");
  }

  const client = getVercelClient(token);

  return await getAllPages((params) => client.teams.getTeams(params), "teams");
}
