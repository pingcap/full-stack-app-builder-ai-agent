"use client";

import type { ChatStatus } from "ai";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffectEvent, useTransition } from "react";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";

export function SessionConversationInput({
  projectId,
  taskId,
  status,
}: {
  projectId: number | undefined | null;
  taskId: number | undefined | null;
  status: ChatStatus;
}) {
  const [transitioning, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = useEffectEvent(
    (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      startTransition(async () => {
        await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}/revisions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: message.text,
          }),
        }).finally(() => {
          startTransition(() => {
            router.refresh();
          });
        });
      });
    },
  );

  return (
    <PromptInputProvider>
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputTextarea />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools></PromptInputTools>
          <PromptInputSubmit
            status={transitioning ? "submitted" : status}
            disabled={
              projectId == null ||
              taskId == null ||
              status !== "ready" ||
              transitioning
            }
          />
        </PromptInputFooter>
      </PromptInput>
    </PromptInputProvider>
  );
}
