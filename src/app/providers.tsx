"use client";

import { QueryCache, QueryClient } from "@tanstack/query-core";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { type Session, SessionProvider } from "@/components/session-context";
import { SidebarProvider } from "@/components/ui/sidebar";

let queryCache: QueryCache | undefined;
if (typeof window === "undefined") {
  queryCache = new (class extends QueryCache {
    add() {
      // noop
    }
  })();
}

const client = new QueryClient({ queryCache });

export default function Providers({
  session,
  children,
}: {
  session: Session | null;
  children: ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={client}>
        <SidebarProvider>{children}</SidebarProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
