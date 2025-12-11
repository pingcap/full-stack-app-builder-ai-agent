import type { InferSession, InferUser } from "better-auth";
import { createContext, type ReactNode, use } from "react";
import type { auth } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import { toSessionUser } from "@/lib/auth-common";

const Context = createContext<{
  session: InferSession<typeof auth>;
  user: InferUser<typeof auth>;
} | null>(null);

export interface Session {
  session: InferSession<typeof auth>;
  user: InferUser<typeof auth>;
}

export function SessionProvider({
  session,
  children,
}: {
  session: Session | null;
  children: ReactNode;
}) {
  const { data, isPending } = authClient.useSession();

  return (
    <Context value={isPending ? session : (data as Session)}>
      {children}
    </Context>
  );
}

export function useSession() {
  return use(Context)?.session;
}

export function useUser() {
  const user = use(Context)?.user;
  return user ? toSessionUser(user) : null;
}
