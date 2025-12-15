import type { DynamicToolUIPart, ProviderMetadata } from "ai";
import { diffLines } from "diff";
import { BookOpen, PencilIcon } from "lucide-react";
import { useMemo } from "react";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { Loader } from "@/components/ai-elements/loader";
import {
  Queue,
  QueueItem,
  QueueItemContent,
  QueueItemIndicator,
  QueueList,
} from "@/components/ai-elements/queue";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { AnsiLogs } from "@/components/ansi-logs";
import { Terminal } from "@/components/terminal";
import { cn } from "@/lib/utils";

type CommonOutput = string;

export type ClaudeBuiltInTools = {
  Edit: {
    input: {
      file_path: string;
      old_string: string;
      new_string: string;
    };
    output: CommonOutput;
  };
  MultiEdit: {
    input: {
      file_path: string;
      edits: {
        old_string: string;
        new_string: string;
      }[];
    };
    output: CommonOutput;
  };
  Write: {
    input: {
      file_path: string;
      content: string;
    };
    output: CommonOutput;
  };
  Read: {
    input: {
      file_path: string;
    };
    output: CommonOutput;
  };
  Bash: {
    input: {
      command: string;
      description: string;
    };
    output: CommonOutput;
  };
  TodoWrite: {
    input: {
      todos: {
        id: number;
        content: string;
        status: "completed" | "in_progress" | "pending";
      }[];
    };
    output: CommonOutput;
  };
};

export function ClaudeToolPart({ part }: { part: DynamicToolUIPart }) {
  switch (part.toolName) {
    case "Edit":
      return <EditPart part={part as never} />;
    case "MultiEdit":
      return <MultiEditPart part={part as never} />;
    case "Write":
      return <WritePart part={part as never} />;
    case "Read":
      return <ReadPart part={part as never} />;
    case "Bash":
      return <BashPart part={part as never} />;
    case "TodoWrite":
      return <TodoWritePart part={part as never} />;
    default: {
      return (
        <Tool>
          <ToolHeader type={`tool-${part.toolName}`} state={part.state} />
          <ToolContent>
            {part.input != null && <ToolInput input={part.input} />}
            {(part.output != null || part.errorText != null) && (
              <ToolOutput output={part.output} errorText={part.errorText} />
            )}
          </ToolContent>
        </Tool>
      );
    }
  }
}

function EditPart({ part }: { part: ClaudeBuiltinToolPart<"Edit"> }) {
  const { text, additions, removals } = useMemo(() => {
    if (!part.input?.old_string || !part.input.new_string)
      return { text: "", additions: 0, removals: 0 };

    const diffData = diffLines(part.input.old_string, part.input.new_string);
    let additions = 0;
    let removals = 0;

    const text = diffData
      .map((dat) => {
        if (dat.added) {
          additions += dat.count;
          return `${dat.value
            .split("\n")
            .map((l) => `+ ${l}`)
            .slice(0, -1)
            .join("\n")}`;
        } else if (dat.removed) {
          removals += dat.count;
          return `${dat.value
            .split("\n")
            .map((l) => `- ${l}`)
            .slice(0, -1)
            .join("\n")}`;
        } else {
          return dat.value;
        }
      })
      .join("\n");

    return { text, additions, removals };
  }, [part.input?.old_string, part.input?.new_string]);

  return (
    <Tool>
      <ToolHeader
        type={`tool-${part.toolName}`}
        state={part.state}
        icon={<PencilIcon className="size-4 text-green-600" />}
        title={
          <div className="flex items-center gap-2">
            <div className="text-nowrap min-w-0 flex-1">
              <div className="w-full h-full overflow-hidden text-ellipsis">
                <span className="text-slate-700 font-semibold">Edit: </span>
                {normalizeFileName(part.input?.file_path)}
              </div>
            </div>
            <div className="text-nowrap min-w-0">
              <span className="text-green-600 font-mono font-semibold">
                +{additions}
              </span>
            </div>
            <div className="text-nowrap min-w-0">
              <span className="text-red-500 font-mono font-semibold">
                -{removals}
              </span>
            </div>
          </div>
        }
      />
      <ToolContent className="p-2">
        <CodeBlock code={text} language="diff" />
      </ToolContent>
    </Tool>
  );
}

function MultiEditPart({ part }: { part: ClaudeBuiltinToolPart<"MultiEdit"> }) {
  const { texts, additions, removals } = useMemo(() => {
    if (!part.input?.edits || !part.input.file_path) {
      return { texts: "", additions: 0, removals: 0 };
    }

    let additions = 0;
    let removals = 0;
    const texts = part.input.edits
      .map((edit) => {
        const diffData = diffLines(edit.old_string, edit.new_string);

        return diffData
          .map((dat) => {
            if (dat.added) {
              additions += dat.count;
              return `${dat.value
                .split("\n")
                .map((l) => `+ ${l}`)
                .slice(0, -1)
                .join("\n")}`;
            } else if (dat.removed) {
              removals += dat.count;
              return `${dat.value
                .split("\n")
                .map((l) => `- ${l}`)
                .slice(0, -1)
                .join("\n")}`;
            } else {
              return dat.value;
            }
          })
          .join("\n");
      })
      .join("\n\n...\n\n");

    return {
      texts,
      additions,
      removals,
    };
  }, [part.state]);

  return (
    <Tool>
      <ToolHeader
        type={`tool-${part.toolName}`}
        state={part.state}
        icon={<PencilIcon className="size-4 text-green-600" />}
        title={
          <div className="flex items-center gap-2">
            <div className="text-nowrap min-w-0 flex-1">
              <div className="w-full h-full overflow-hidden text-ellipsis">
                <span className="text-slate-700 font-semibold">Edit: </span>
                {normalizeFileName(part.input?.file_path)}
              </div>
            </div>
            <div className="text-nowrap min-w-0">
              <span className="text-green-600 font-mono font-semibold">
                +{additions}
              </span>
            </div>
            <div className="text-nowrap min-w-0">
              <span className="text-red-500 font-mono font-semibold">
                -{removals}
              </span>
            </div>
          </div>
        }
      />
      <ToolContent className="p-2">
        <CodeBlock code={texts} language="diff" />
      </ToolContent>
    </Tool>
  );
}

function WritePart({ part }: { part: ClaudeBuiltinToolPart<"Write"> }) {
  const lines = useMemo(() => {
    return part.input?.content?.split("\n");
  }, [part.input]);

  return (
    <Tool>
      <ToolHeader
        type={`tool-${part.toolName}`}
        state={part.state}
        icon={<PencilIcon className="size-4 text-green-600" />}
        title={
          <div className="flex items-center gap-2">
            <div className="text-nowrap min-w-0 flex-1">
              <div className="w-full h-full overflow-hidden text-ellipsis">
                <span className="text-slate-700 font-semibold">Write </span>
                {normalizeFileName(part.input?.file_path)}
              </div>
            </div>
            <div className="text-green-600 font-mono font-semibold text-nowrap min-w-0">
              +{lines?.length}
            </div>
          </div>
        }
      />
      <ToolContent className="p-2">
        <CodeBlock
          code={lines?.map((l) => `+ ${l}`).join("\n") ?? ""}
          language="diff"
        />
      </ToolContent>
    </Tool>
  );
}

function ReadPart({ part }: { part: ClaudeBuiltinToolPart<"Read"> }) {
  const lines = useMemo(() => {
    if (!part.output) {
      return 0;
    }

    const lines: string[] = [];
    const regexp = /^\s+\d+�(.+)$/gm;

    let matched: RegExpMatchArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: no why
    while ((matched = regexp.exec(part.output)) !== null) {
      lines.push(matched[1]!);
    }

    return lines.length;
  }, [part.output]);

  return (
    <Tool>
      <ToolHeader
        type={`tool-${part.toolName}`}
        state={part.state}
        icon={<BookOpen className="size-4 text-green-600" />}
        title={
          <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            <span>
              <span className="text-slate-700 font-semibold">Read</span> {lines}{" "}
              lines from {normalizeFileName(part.input?.file_path)}
            </span>
          </div>
        }
      />
    </Tool>
  );
}

function BashPart({ part }: { part: ClaudeBuiltinToolPart<"Bash"> }) {
  return (
    <Terminal className="mb-4">
      <span className="text-muted-foreground italic">
        # {part.input?.description}
      </span>
      <span>
        <span className="text-muted-foreground font-semibold">$</span>{" "}
        {part.input?.command}
      </span>
      {!part.state.startsWith("output-") && (
        <span>
          <Loader />
        </span>
      )}
      {part.output && <AnsiLogs raw={part.output} />}
      {part.errorText && (
        <div className="text-destructive">
          <AnsiLogs raw={part.errorText} />
        </div>
      )}
    </Terminal>
  );
}

function TodoWritePart({ part }: { part: ClaudeBuiltinToolPart<"TodoWrite"> }) {
  return (
    <Queue>
      <ClaudeTodoList todos={part.input?.todos ?? []} />
    </Queue>
  );
}

export function ClaudeTodoList({
  todos,
}: {
  todos: ClaudeBuiltInTools["TodoWrite"]["input"]["todos"];
}) {
  return (
    <QueueList>
      {todos.map((todo, index) => (
        <QueueItem
          key={todo.id ?? `todo-${index}`}
          className={cn(todo.status === "in_progress" && "bg-muted")}
        >
          <div className="flex items-center gap-2">
            {todo.status === "in_progress" ? (
              <Loader className="size-4" />
            ) : todo.status === "completed" ? (
              <QueueItemIndicator completed />
            ) : (
              <QueueItemIndicator completed={false} />
            )}
            <QueueItemContent completed={todo.status === "completed"}>
              {todo.content}
            </QueueItemContent>
          </div>
        </QueueItem>
      ))}
    </QueueList>
  );
}

export type ClaudeBuiltinToolPart<K extends keyof ClaudeBuiltInTools> = {
  toolName: K;
  toolCallId: string;
} & (
  | {
      state: "input-streaming";
      input: Partial<ClaudeBuiltInTools[K]["input"]> | undefined;
      output?: never;
      errorText?: never;
      approval?: never;
    }
  | {
      state: "input-available";
      input: ClaudeBuiltInTools[K]["input"];
      output?: never;
      errorText?: never;
      callProviderMetadata?: ProviderMetadata;
      approval?: never;
    }
  | {
      state: "approval-requested";
      input: ClaudeBuiltInTools[K]["input"];
      output?: never;
      errorText?: never;
      callProviderMetadata?: ProviderMetadata;
      approval: {
        id: string;
        approved?: never;
        reason?: never;
      };
    }
  | {
      state: "approval-responded";
      input: ClaudeBuiltInTools[K]["input"];
      output?: never;
      errorText?: never;
      callProviderMetadata?: ProviderMetadata;
      approval: {
        id: string;
        approved: boolean;
        reason?: string;
      };
    }
  | {
      state: "output-available";
      input: ClaudeBuiltInTools[K]["input"];
      output: ClaudeBuiltInTools[K]["output"];
      errorText?: never;
      callProviderMetadata?: ProviderMetadata;
      preliminary?: boolean;
      approval?: {
        id: string;
        approved: true;
        reason?: string;
      };
    }
  | {
      state: "output-error";
      input: ClaudeBuiltInTools[K]["input"];
      output?: never;
      errorText: string;
      callProviderMetadata?: ProviderMetadata;
      approval?: {
        id: string;
        approved: true;
        reason?: string;
      };
    }
  | {
      state: "output-denied";
      input: ClaudeBuiltInTools[K]["input"];
      output?: never;
      errorText?: never;
      callProviderMetadata?: ProviderMetadata;
      approval: {
        id: string;
        approved: false;
        reason?: string;
      };
    }
);

function normalizeFileName(src: string | undefined) {
  return src?.replace(/^\/vercel\/sandbox\//, "");
}
