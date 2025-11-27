"use client";

import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DB } from "@/lib/db/schema";
import type { Selectable } from "kysely";
import Link from "next/link";
import { useState } from "react";

export function TasksList({
  projectId,
  tasks,
}: {
  projectId: number;
  tasks: Array<Selectable<DB["task"]> & { revisions_count: number | null }>;
}) {
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);

  return (
    <div className="rounded-lg border space-y-2 p-2">
      <div>
        <CreateTaskDialog
          projectId={projectId}
          open={createTaskDialogOpen}
          onOpenChange={setCreateTaskDialogOpen}
        >
          <DialogTrigger asChild>
            <Button variant="outline">New Task</Button>
          </DialogTrigger>
        </CreateTaskDialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Git Revision Ref</TableHead>
            <TableHead>Git Branch Name</TableHead>
            <TableHead>Revisions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableHead>
                <Link
                  className="underline"
                  href={`/projects/${projectId}/tasks/${task.id}`}
                >
                  {task.name}
                </Link>
              </TableHead>
              <TableCell>{task.git_revision_ref}</TableCell>
              <TableCell>{task.git_branch_name}</TableCell>
              <TableCell>{task.revisions_count}</TableCell>
            </TableRow>
          ))}
          {tasks.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>
                <Empty>
                  <EmptyTitle>No task yet</EmptyTitle>
                </Empty>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
