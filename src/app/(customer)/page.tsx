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
    <div className="min-h-screen w-full flex items-center justify-center">
      <div
        className="space-y-4"
        style={{
          width: "480px",
          height: "max-content",
          flexShrink: 0,
        }}
      >
        <img
          className="block mx-auto w-72"
          src="/TiDB-Logo-w-Tagline-Full-Pos-RGB.svg"
          alt="Logo"
        />
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
  );
}
