"use client";

import type { Selectable } from "kysely";
import {
  AudioWaveform,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
} from "lucide-react";
import { SessionContext } from "next-auth/react";
import type * as React from "react";
import { use } from "react";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import db from "@/lib/db/db";
import type { DB } from "@/lib/db/schema";
import { getAll } from "@/lib/kysely-utils";

// This is sample data.
const data = {
  teams: [
    {
      name: "Acme Inc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "GitHub Account",
          url: "/settings/github-account",
        },
        {
          title: "Vercel Account",
          url: "/settings/vercel-account",
        },
        {
          title: "TiDB Cloud Account",
          url: "/settings/tidbcloud-account",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
};

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
      <SidebarHeader>codegen.tidb.ai</SidebarHeader>
      <SidebarContent>
        <NavProjects sessions={sessions} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={session.data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
