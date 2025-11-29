"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { UISessionData } from "@/app/(customer)/s/[slug]/query";
import type { UISessionMessageChunk } from "@/prompts/ui-session";

export function Reloader({ session }: { session: UISessionData }) {
  const router = useRouter();
  useEffect(() => {
    if (!Array.isArray(session.logs)) {
      return;
    }

    if (
      session.logs.some((item) => {
        return (item as UISessionMessageChunk).type === "error";
      })
    ) {
      return;
    }

    let shouldReload = false;
    let interval = 1000;

    if (session.project?.status !== "ready") {
      shouldReload = true;
      interval = 3000;
    }

    if (session.task_revisions.length === 0) {
      shouldReload = true;
      interval = 2500;
    }

    for (const revision of session.task_revisions) {
      if (revision.status === "preparing") {
        shouldReload = true;
        interval = 5000;
        break;
      }
      if (revision.status === "running") {
        shouldReload = true;
        interval = 5000;
        break;
      }
      if (revision.status === "deploying") {
        shouldReload = true;
        interval = 5000;
        break;
      }
    }

    if (shouldReload) {
      console.log(`reload after ${interval}ms...`);

      const th = setTimeout(() => {
        router.refresh();
      }, interval);

      return () => clearTimeout(th);
    }
  }, [session, router]);
  return null;
}
