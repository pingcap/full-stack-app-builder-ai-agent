import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import db from "@/lib/db/db";
import { getAll } from "@/lib/kysely-utils";
import Link from "next/link";

export default async function Projects() {
  const projects = await getAll(db, "project", {});
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Repo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id}>
              <TableHead>
                <Link className="underline" href={`/projects/${project.id}`}>
                  {project.name}
                </Link>
              </TableHead>
              <TableCell>{project.status}</TableCell>
              <TableCell>
                {project.github_owner}/{project.github_repo}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
