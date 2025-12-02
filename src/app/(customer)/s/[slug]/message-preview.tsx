import { isToolUIPart, type UIMessage } from "ai";
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
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { ClaudeToolPart } from "@/components/claude-tool-part";
import { CodexToolPart } from "@/components/codex-tool-part";

export function MessagePreview({
  coding_agent_type,
  message,
}: {
  coding_agent_type: string;
  message: UIMessage | undefined | null;
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
                if (coding_agent_type === "codex") {
                  if (isToolUIPart(part)) {
                    return (
                      <CodexToolPart
                        key={`${part.type}-${index}`}
                        part={part as never}
                      />
                    );
                  }
                  if (part.type === "dynamic-tool") {
                    return (
                      <Tool>
                        <ToolHeader
                          type={`tool-${part.toolName}`}
                          state={part.state}
                        />
                        <ToolContent>
                          {part.input != null && (
                            <ToolInput input={part.input} />
                          )}
                          {(part.output != null || part.errorText != null) && (
                            <ToolOutput
                              output={part.output}
                              errorText={part.errorText}
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }
                } else if (/^claude(-opus)?/.test(coding_agent_type)) {
                  if (part.type === "dynamic-tool") {
                    return (
                      <ClaudeToolPart
                        key={`${part.type}-${index}`}
                        part={part}
                      />
                    );
                  }
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
