"use client";

import { PlayIcon } from "lucide-react";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import type { UISessionData } from "@/app/(customer)/s/[slug]/query";
import { MessageAction } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";

export const PreviewIndexContext = createContext<{
  previewIndex: number;
  setPreviewIndex: (index: number) => void;
}>({ previewIndex: -1, setPreviewIndex: () => {} });

export function PreviewIndexProvider({
  session,
  children,
}: {
  session: UISessionData;
  children: ReactNode;
}) {
  const [index, setIndex] = useState<number>(
    session.task_revisions.length - 1,
  );
  useEffect(() => {
    setIndex(session.task_revisions.length - 1);
  }, [session.task_revisions.length]);
  return (
    <PreviewIndexContext
      value={{ previewIndex: index, setPreviewIndex: setIndex }}
    >
      {children}
    </PreviewIndexContext>
  );
}

export function PreviewAction({ index }: { index: number }) {
  const { previewIndex, setPreviewIndex } = use(PreviewIndexContext);
  return (
    <MessageAction
      className={cn(
        index === previewIndex &&
          "[&>svg]:text-green-500 [&>svg]:fill-green-500",
      )}
      onClick={() => {
        setPreviewIndex(index);
      }}
    >
      <PlayIcon />
    </MessageAction>
  );
}
