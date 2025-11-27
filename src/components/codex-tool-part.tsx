import type { FileChangeItem, TodoListItem } from "@openai/codex-sdk";
import type { ToolUIPart } from "ai";
import { FileDiffIcon, FileMinusIcon, FilePlusIcon } from "lucide-react";
import {
  Queue,
  QueueItem,
  QueueItemContent,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "@/components/ai-elements/queue";
import { Terminal } from "@/components/terminal";

// See https://github.com/openai/codex/blob/main/docs/exec.md
//
// Supported tool types:
// - `command_execution` - assistant executing a command.
// - `file_change` - assistant making file changes.
// - `web_search` - assistant performing a web search.
// - `todo_list` - the agent's running plan when the plan tool is active, updating as steps change.

export type CodexTools = {
  todo_list: {
    input: TodoListItem["items"]; // Input should be ignored.
    output: TodoListItem["items"];
  };
  web_search: {
    input: string;
    output: undefined;
  };
  command_execution: {
    input: string;
    output: string;
  };
  file_change: {
    input: FileChangeItem["changes"];
    output: FileChangeItem["status"];
  };
};

export function CodexToolPart({ part }: { part: ToolUIPart<CodexTools> }) {
  switch (part.type) {
    case "tool-todo_list":
      return <CodexToolTodoListPart part={part} />;
    case "tool-file_change":
      return <CodexToolFileChangePart part={part} />;
    case "tool-web_search":
      return <CodexToolWebSearchPart part={part} />;
    case "tool-command_execution":
      return <CodexToolCommandExecutionPart part={part} />;
  }
}

export function CodexToolTodoListPart({
  part,
}: {
  part: ToolUIPart<Pick<CodexTools, "todo_list">>;
}) {
  return (
    <Queue className="mb-4">
      <QueueSection>
        <QueueSectionTrigger>
          <QueueSectionLabel count={part.output?.length} label="Todo List" />
        </QueueSectionTrigger>
        <QueueSectionContent>
          <QueueList>
            {part.output?.map((item) => (
              <QueueItem key={item.text}>
                <div className="flex items-center gap-2">
                  <QueueItemIndicator completed={item.completed} />
                  <QueueItemContent completed={item.completed}>
                    {item.text}
                  </QueueItemContent>
                </div>
              </QueueItem>
            ))}
          </QueueList>
        </QueueSectionContent>
      </QueueSection>
    </Queue>
  );
}

export function CodexToolFileChangePart({
  part,
}: {
  part: ToolUIPart<Pick<CodexTools, "file_change">>;
}) {
  return (
    <div className="mb-4 space-y-2">
      <div>File changes ({part.output})</div>
      {part.input?.map((change, index) => (
        <div key={`${change?.path}-${index}`}>
          <div className="flex items-center gap-2 text-muted-foreground">
            {change?.kind === "add" && <FilePlusIcon className="size-4" />}
            {change?.kind === "delete" && <FileMinusIcon className="size-4" />}
            {change?.kind === "update" && <FileDiffIcon className="size-4" />}
            <span>{change?.path}</span>
          </div>
        </div>
      ))}
      {part.errorText && (
        <div className="text-destructive">{part.errorText}</div>
      )}
    </div>
  );
}

export function CodexToolWebSearchPart({
  part,
}: {
  part: ToolUIPart<Pick<CodexTools, "web_search">>;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Search for <span className="font-medium">{part.input}</span>
      </p>
      <div className="h-1 bg-muted rounded-full" />
    </div>
  );
}

export function CodexToolCommandExecutionPart({
  part,
}: {
  part: ToolUIPart<Pick<CodexTools, "command_execution">>;
}) {
  return (
    <Terminal className="mb-4">
      <span>
        <span className="text-muted-foreground font-semibold">$</span>{" "}
        {part.input}
      </span>
      {part.output && (
        <span className="text-muted-foreground">{part.output}</span>
      )}
      {part.errorText && (
        <span className="text-destructive">{part.errorText}</span>
      )}
    </Terminal>
  );
}
