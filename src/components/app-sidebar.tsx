"use client";

import type { Selectable } from "kysely";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { useUser } from "@/components/session-context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type { DB } from "@/lib/db/schema";
import type { Role } from "@/lib/role";

export function AppSidebar({
  sessions,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  sessions: Selectable<DB["ui_session"]>[];
}) {
  const pathname = usePathname();
  const user = useUser();

  if (!user) return null;

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
        {(["admin"] as Role[]).includes(user.role) && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/settings/github-account"}
                    asChild
                  >
                    <Link href="/settings/github-account">Github Account</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/settings/vercel-account"}
                    asChild
                  >
                    <Link href="/settings/vercel-account">Vercel Account</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/settings/tidbcloud-account"}
                    asChild
                  >
                    <Link href="/settings/tidbcloud-account">
                      TiDB Cloud Account
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/settings/openai-account"}
                    asChild
                  >
                    <Link href="/settings/openai-account">OpenAI Account</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
