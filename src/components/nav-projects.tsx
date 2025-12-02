"use client";

import { capitalCase } from "change-case";
import type { Selectable } from "kysely";
import {
  ChevronDown,
  Folder,
  Forward,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { DB } from "@/lib/db/schema";
import { getErrorMessage, handleFetchResponseError } from "@/lib/errors";

export function NavProjects({
  sessions,
}: {
  sessions: Selectable<DB["ui_session"]>[];
}) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [_, slug] = useSelectedLayoutSegments();
  const [showAll, setShowAll] = useState(false);

  const visibleSessions = useMemo(() => {
    if (showAll || sessions.length <= 7) {
      return sessions;
    }
    return sessions.slice(0, 7);
  }, [sessions, showAll]);

  const showToggle = sessions.length > 7;

  return (
    <>
      <SidebarGroup className="pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="font-medium">
              <Link href="/">
                <Plus className="h-4 w-4" />
                <span>New Project</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Projects</SidebarGroupLabel>
        <SidebarMenu>
          {visibleSessions.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton asChild isActive={slug === item.slug}>
                <Link href={`/s/${encodeURIComponent(item.slug)}`}>
                  <span>{item.title || capitalCase(item.slug)}</span>
                </Link>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction showOnHover>
                    <MoreHorizontal />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-48 rounded-lg"
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(ev) => ev.preventDefault()}>
                        <Trash2 className="text-muted-foreground" />
                        <span>Delete Project</span>
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you sure to delete {item.title}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will delete github repo, vercel project and
                          tidbcloud cluster.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            const id = toast.loading(`Deleting ${item.title}`);
                            const isCurrentProject = slug === item.slug;
                            fetch(`/api/v1/projects/${item.project_id}`, {
                              method: "DELETE",
                            })
                              .then(handleFetchResponseError)
                              .then(() => {
                                toast.dismiss(id);
                                toast.success(`Deleted ${item.title}.`);
                                if (isCurrentProject) router.push("/");
                                router.refresh();
                              })
                              .catch((err) => {
                                toast.dismiss(id);
                                toast.error(`Failed to delete ${item.title}`, {
                                  description: getErrorMessage(err),
                                });
                              });
                          }}
                          asChild
                        >
                          <Button variant="destructive">DELETE IT</Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          ))}
          {showToggle ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setShowAll((prev) => !prev)}
                className="text-muted-foreground"
              >
                <span>{showAll ? "Show less" : "Show all"}</span>
                <ChevronDown
                  className={`ml-auto h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`}
                />
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarGroup>
    </>
  );
}
