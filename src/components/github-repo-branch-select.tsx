import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

export function GithubRepoBranchSelect({
  id,
  name,
  className,
  enabled,
  branch,
  onBranchChange,
  projectId,
  onBlur,
}: {
  id?: string;
  name?: string;
  projectId: number;
  className?: string;
  enabled?: boolean;
  branch?: string | null;
  onBranchChange?: (branch: string) => void;
  onBlur?: () => void;
}) {
  const {
    data: branches,
    isLoading: isBranchesLoading,
    error: branchesError,
  } = useQuery<{ name: string; commit: { sha: string } }[]>({
    queryKey: ["projects", projectId, "git-branches"],
    enabled,
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/projects/${projectId}/git-branches`,
      );
      return response.json();
    },
  });

  return (
    <Select
      name={name}
      value={branch ?? ""}
      onValueChange={onBranchChange}
      disabled={!enabled || isBranchesLoading || !!branchesError}
    >
      <SelectTrigger id={id} className={className} onBlur={onBlur}>
        <SelectValue placeholder="Select a branch" />
      </SelectTrigger>
      <SelectContent>
        {branches?.map((branch) => (
          <SelectItem key={branch.name} value={branch.name}>
            <Badge variant="outline">{branch.commit.sha.slice(0, 8)}</Badge>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
