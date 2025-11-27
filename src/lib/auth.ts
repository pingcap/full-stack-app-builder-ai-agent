import { getServerSession } from "next-auth/next";
import { cache } from "react";
import authOptions from "@/lib/auth-options";
import db from "@/lib/db/db";
import { get } from "@/lib/kysely-utils";

async function $getSession() {
  return await getServerSession({
    callbacks: {
      session: authOptions.callbacks.session,
    },
  });
}

async function $getSessionUserSettings() {
  const user = await getSessionUser();
  if (user) {
    return await get(db, "user_setting", { user_id: user.id });
  }
  return undefined;
}

export const getSession = cache($getSession);

export async function getSessionUser() {
  return (await $getSession())?.user;
}

export const getSessionUserSettings = cache($getSessionUserSettings);
