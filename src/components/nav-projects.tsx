"use client";

import { capitalCase } from "change-case";
import type { Selectable } from "kysely";
import {
  ChevronDown,
  Folder,
  Forward,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { useMemo, useState } from "react";
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

export function NavProjects({
  sessions,
}: {
  sessions: Selectable<DB["ui_session"]>[];
}) {
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
    <SidebarGroup>
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {visibleSessions.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton asChild isActive={slug === item.slug}>
              <Link href={`/s/${encodeURIComponent(item.slug)}`}>
                <span>{capitalCase(item.slug)}</span>
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
                <DropdownMenuItem>
                  <Trash2 className="text-muted-foreground" />
                  <span>Delete Project</span>
                </DropdownMenuItem>
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
  );
}
