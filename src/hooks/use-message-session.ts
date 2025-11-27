import { handleFetchResponseError } from "@/lib/errors";
import {
  parseJsonEventStream,
  readUIMessageStream,
  type UIDataTypes,
  type UIMessage,
  uiMessageChunkSchema,
  type UITools,
} from "ai";
import { useEffect, useState } from "react";

export function useMessageSession<Tools extends UITools>(sessionId: string) {
  const [version, setVersion] = useState<number>(0);
  const [error, setError] = useState<unknown>(undefined);
  const [uiMessage, setUIMessage] = useState<
    UIMessage<unknown, UIDataTypes, Tools> | undefined
  >(undefined);

  useEffect(() => {
    const abortController = new AbortController();
    const request = fetch(`/api/v1/debug/streams/${sessionId}`, {
      signal: abortController.signal,
    }).then(handleFetchResponseError);

    (async () => {
      try {
        const response = await request;

        if (!response.body) {
          setError("No response body.");
          return;
        }

        const messageStream = readUIMessageStream<
          UIMessage<unknown, UIDataTypes, Tools>
        >({
          stream: parseJsonEventStream({
            stream: response.body,
            schema: uiMessageChunkSchema,
          }).pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                if (chunk.success) {
                  controller.enqueue(chunk.value);
                } else {
                  console.error(
                    "Error parsing stream chunk:",
                    chunk.rawValue,
                    chunk.error,
                  );
                }
              },
            }),
          ),
        });

        for await (const message of messageStream) {
          setUIMessage(message);
        }
      } catch (e) {
        setError(e);
      }
    })();

    return () => abortController.abort();
  }, [sessionId, version]);

  return {
    message: uiMessage,
    error,
    retry: () => {
      setVersion((v) => v + 1);
    },
  };
}
