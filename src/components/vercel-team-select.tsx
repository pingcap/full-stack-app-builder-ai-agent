import { Avatar, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import type { Team } from "@vercel/sdk/models/team";
import type { TeamLimited } from "@vercel/sdk/models/teamlimited";

export function VercelTeamSelect({
  id,
  name,
  className,
  enabled,
  teamId,
  onTeamIdChange,
  onBlur,
}: {
  id?: string;
  name?: string;
  className?: string;
  enabled?: boolean;
  teamId?: string | null;
  onTeamIdChange?: (teamId: string) => void;
  onBlur?: () => void;
}) {
  const {
    data: teams,
    isLoading: isTeamsLoading,
    error: teamsError,
  } = useQuery<(Team | TeamLimited)[]>({
    queryKey: ["teams"],
    enabled,
    queryFn: async () => {
      const response = await fetch("/api/v1/vercel/teams");
      return response.json();
    },
  });

  return (
    <Select
      name={name}
      value={teamId ?? ""}
      onValueChange={onTeamIdChange}
      disabled={!enabled || isTeamsLoading || !!teamsError}
    >
      <SelectTrigger id={id} className={className} onBlur={onBlur}>
        <SelectValue placeholder="Select a team" />
      </SelectTrigger>
      <SelectContent>
        {teams?.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            <Avatar className="size-6">
              <AvatarImage
                src={
                  team.avatar
                    ? `https://vercel.com/api/www/avatar/${team.avatar}`
                    : undefined
                }
                alt={team.name ?? team.slug}
              />
            </Avatar>
            {team.name ?? team.slug}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
