"use client";

import { useRouter } from "next/navigation";
import type * as React from "react";
import {
  type FormEvent,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import type { CreateSessionResult } from "@/app/api/v1/sessions/route";
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
import { handleFetchResponseError } from "@/lib/errors";
import { getAll } from "@/lib/kysely-utils";

export default function Page() {
  const router = useRouter();
  const [transitioning, startTransition] = useTransition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");

  const handleSubmit = useEffectEvent(
    (message: PromptInputMessage, event: FormEvent) => {
      event.preventDefault();
      setStatus("submitted");
      fetch("/api/v1/sessions", {
        method: "POST",
        body: JSON.stringify({
          first_prompt: message.text,
        }),
      })
        .then(handleFetchResponseError)
        .then((res) => {
          return res.json().then((data: CreateSessionResult) => {
            setStatus("streaming");
            startTransition(() => {
              router.push(`/s/${data.slug}`);
            });
          });
        })
        .catch((err) => {
          setStatus("error");
        });
    },
  );

  return (
    <div className="h-full w-full flex flex-col items-center px-4">
      <div className="text-center space-y-2 w-full max-w-xl pt-12">
        <h1 className="text-2xl font-semibold">
          Full-Stack App-Builder AI Agent
        </h1>
        <p className="text-muted-foreground text-sm">
          Think of this as a lean, self-hostable cousin of Lovable.dev—describe
          an app, watch Codex (gpt-5.1-codex) and Claude Code
          (claude-sonnet-4.5) plus TiDB Cloud, Vercel, and GitHub build, test,
          and deploy it automatically.
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center w-full">
        <div
          className="space-y-4"
          style={{
            width: "480px",
            height: "max-content",
            flexShrink: 0,
          }}
        >
          <PromptInputProvider>
            <PromptInput onSubmit={handleSubmit}>
              <PromptInputBody>
                <PromptInputTools />
                <PromptInputTextarea ref={textareaRef} />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputSubmit
                  status={transitioning ? "streaming" : status}
                  disabled={
                    transitioning ||
                    status === "submitted" ||
                    status === "streaming"
                  }
                />
              </PromptInputFooter>
            </PromptInput>
          </PromptInputProvider>
        </div>
      </div>
    </div>
  );
}
