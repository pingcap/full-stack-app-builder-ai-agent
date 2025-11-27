import { isToolUIPart, type UIDataTypes, type UIMessage } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageResponse } from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { CodexToolPart, type CodexTools } from "@/components/codex-tool-part";

export function CodexMessagePreview({
  message,
}: {
  message: UIMessage<unknown, UIDataTypes, CodexTools> | undefined | null;
}) {
  return (
    <Conversation className="size-full">
      <ConversationContent>
        <Message from="assistant" className="max-w-full">
          {message?.parts.map((part, index) => {
            switch (part.type) {
              case "text":
                return (
                  <MessageResponse key={`${part.type}-${index}`}>
                    {part.text}
                  </MessageResponse>
                );
              case "reasoning":
                return (
                  <Reasoning key={`${part.type}-${index}`}>
                    <ReasoningTrigger />
                    <ReasoningContent>{part.text}</ReasoningContent>
                  </Reasoning>
                );
              default:
                if (isToolUIPart(part)) {
                  return (
                    <CodexToolPart
                      key={`${part.type}-${index}`}
                      part={part as never}
                    />
                  );
                }
                return null;
            }
          })}
        </Message>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
