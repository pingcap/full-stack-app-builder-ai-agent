"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { auth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";

export async function signIn(
  body: z.infer<(typeof auth.api.signInEmail)["options"]["body"]>,
) {
  try {
    const session = await auth.api.signInEmail({
      body,
    });

    if (session.redirect) {
      redirect(
        new URL(session.url ?? "/", process.env.BETTER_AUTH_URL!).toString(),
      );
    }
  } catch (e) {
    if (isRedirectError(e)) {
      return Promise.reject(e);
    }

    const message = getErrorMessage(e);
    redirect(
      new URL(
        `/login?error=${encodeURIComponent(message)}`,
        process.env.BETTER_AUTH_URL!,
      ).toString(),
    );
  }
}
