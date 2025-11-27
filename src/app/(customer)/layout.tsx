import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import db from "@/lib/db/db";
import { getAll } from "@/lib/kysely-utils";

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const sessions = await getAll(db, "ui_session", {}, ["created_at", "desc"]);

  return (
    <>
      <AppSidebar sessions={sessions} />
      <SidebarInset className="h-screen">
        <div className="w-full flex-1 overflow-hidden">
          <div className="size-full overflow-hidden p-4">{children}</div>
        </div>
      </SidebarInset>
    </>
  );
}
