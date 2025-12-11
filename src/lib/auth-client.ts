import { type BetterAuthClientOptions, InferAuth } from "better-auth/client";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  $InferAuth: InferAuth<typeof auth>(),
} as const satisfies BetterAuthClientOptions);
