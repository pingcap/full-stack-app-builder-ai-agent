import { createStreamingUIMessageState, processUIMessageStream, type StreamingUIMessageState, type UIMessage, type UIMessageChunk } from 'ai';

export async function fastReadUIMessageStream<UI_MESSAGE extends UIMessage> ({
    stream,
    messageId,
    state: propState,
  }: {
    stream: ReadableStream<UIMessageChunk>
    messageId: string,
    state?: StreamingUIMessageState<UI_MESSAGE>,
  },
) {
  const state = propState ?? createStreamingUIMessageState<UI_MESSAGE>({
    lastMessage: undefined,
    messageId,
  });

  const res = processUIMessageStream<UI_MESSAGE>({
    stream,
    runUpdateMessageJob (
      job: (options: {
        state: StreamingUIMessageState<UI_MESSAGE>;
        write: () => void;
      }) => Promise<void>,
    ) {
      return job({
        state,
        write: () => {
        },
      });
    },
    onError: (error) => {
      // ignore error chunk
      state.message.metadata ??= {};
      (state.message.metadata as any).__stream_error__ = (error as Error).message;
    },
  });

  let chunks = 0;

  for await (const _ of res) {
    chunks++;
  }

  return { chunks, state };
}
