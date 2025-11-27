"use client";

import type { Selectable } from "kysely";
import { SessionContext } from "next-auth/react";
import type * as React from "react";
import { use } from "react";
import Link from "next/link";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import type { DB } from "@/lib/db/schema";

export function AppSidebar({
  sessions,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  sessions: Selectable<DB["ui_session"]>[];
}) {
  const session = use(SessionContext);

  if (!session?.data?.user) return null;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="items-start">
        <Link href="/" aria-label="Home">
          <img
            className="h-18"
            src="/TiDB-Logo-w-Tagline-Full-Pos-RGB.svg"
            alt="Logo"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavProjects sessions={sessions} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={session.data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
