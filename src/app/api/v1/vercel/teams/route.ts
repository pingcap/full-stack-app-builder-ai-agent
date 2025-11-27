import { listTeams } from "@/lib/vercel/teams";

export async function GET() {
  const teams = await listTeams();

  return Response.json(teams);
}
