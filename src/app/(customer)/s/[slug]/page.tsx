import type { ChatStatus } from "ai";
import { capitalCase } from "change-case";
import { CodeIcon, ListTodo } from "lucide-react";
import type { Metadata } from "next";
import { cache, Fragment, Suspense } from "react";
import { SessionConversationInput } from "@/app/(customer)/s/[slug]/conversation-input";
import { MessageOverview } from "@/app/(customer)/s/[slug]/message-overview";
import { MessagePreview } from "@/app/(customer)/s/[slug]/message-preview";
import { MessageStreamPreview } from "@/app/(customer)/s/[slug]/message-stream-preview";
import {
  PreviewAction,
  PreviewIndexProvider,
} from "@/app/(customer)/s/[slug]/preview-index-provider";
import { getSessionData } from "@/app/(customer)/s/[slug]/query";
import { Reloader } from "@/app/(customer)/s/[slug]/reloader";
import { SessionPrepareState } from "@/app/(customer)/s/[slug]/session-prepare-state";
import { SessionProjectLinks } from "@/app/(customer)/s/[slug]/session-project-links";
import { SessionTaskRevisionPreview } from "@/app/(customer)/s/[slug]/task-revision-preview";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { AutoCollapse } from "@/components/auto-collapse";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const cachedGetSessionData = cache(getSessionData);

export default async function SessionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = decodeURIComponent((await params).slug);

  const session = await cachedGetSessionData(slug);
  const projectDisplayName =
    session.title ||
    capitalCase((session.project?.name ?? "").replace(/-[^-]+$/, ""));

  const chatStatus: ChatStatus =
    session.task_revisions.length === 0
      ? "submitted"
      : session.task_revisions[session.task_revisions.length - 1].status ===
          "finished"
        ? "ready"
        : session.task_revisions[session.task_revisions.length - 1].status ===
            "interrupted"
          ? "error"
          : "streaming";

  return (
    <PreviewIndexProvider session={session}>
      <div
        className="size-full overflow-hidden grid grid-cols-2 gap-4"
        suppressHydrationWarning
      >
        <Reloader session={session} />
        <div
          className="size-full p-4 overflow-hidden flex flex-col gap-4"
          suppressHydrationWarning
        >
          <div className="flex items-center gap-3">
            <ListTodo className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold leading-tight">
              {projectDisplayName}
            </h1>
            <Suspense>
              <SessionProjectLinks session={session} />
            </Suspense>
          </div>
          <div className="flex-1 overflow-hidden">
            <Conversation className="size-full">
              <ConversationContent>
                <SessionPrepareState session={session} />
                {session.task_revisions.map(
                  (task_revision, task_revision_index) => (
                    <Fragment key={task_revision.id}>
                      <Message from="user" className="overflow-x-hidden">
                        <MessageContent className="max-w-full overflow-x-hidden">
                          <AutoCollapse collapseThresholdHeight={144}>
                            <MessageResponse>
                              {task_revision.user_prompt}
                            </MessageResponse>
                          </AutoCollapse>
                        </MessageContent>
                      </Message>
                      <Message from="assistant" className="min-h-[50vh]">
                        {task_revision.agent_result ? (
                          <MessageContent className="max-w-full overflow-x-hidden">
                            <AutoCollapse
                              collapseThresholdHeight={288}
                              className="from-white/100 to-white/0"
                            >
                              <MessageResponse>
                                {task_revision.agent_result}
                              </MessageResponse>
                            </AutoCollapse>
                          </MessageContent>
                        ) : (
                          <MessageOverview
                            task_revision={task_revision}
                            coding_agent_type={
                              session.project?.coding_agent_type ?? ""
                            }
                          />
                        )}
                        {task_revision.status === "failed" && (
                          <Alert variant="destructive">
                            <AlertTitle>Failed to setup environment</AlertTitle>
                            <AlertDescription>
                              {task_revision.error}
                            </AlertDescription>
                          </Alert>
                        )}
                        {task_revision.status !== "interrupted" &&
                          task_revision.status !== "failed" && (
                            <Actions
                              task_revision={task_revision}
                              index={task_revision_index}
                            />
                          )}
                      </Message>
                    </Fragment>
                  ),
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          </div>
          <div className="w-full">
            <SessionConversationInput
              projectId={session.project_id}
              taskId={session.task_id}
              status={chatStatus}
            />
          </div>
        </div>
        <div className="size-full p-4 overflow-hidden">
          <SessionTaskRevisionPreview
            session={session}
            chatStatus={chatStatus}
          />
        </div>
      </div>
    </PreviewIndexProvider>
  );

  function Actions({
    task_revision,
    index,
  }: {
    task_revision: (typeof session.task_revisions)[number];
    index: number;
  }) {
    if (task_revision.status === "preparing") {
      return null;
    }

    return (
      <MessageActions>
        <PreviewAction index={index} />
        <Sheet>
          <SheetTrigger asChild>
            <MessageAction>
              <CodeIcon />
            </MessageAction>
          </SheetTrigger>
          <SheetContent className="sm:max-w-[480px] w-3/4">
            <SheetHeader>
              <SheetTitle>Details</SheetTitle>
              <SheetDescription />
            </SheetHeader>
            <div className="flex-1 p-2 overflow-hidden">
              {task_revision.agent_message ? (
                <MessagePreview
                  message={task_revision.agent_message as never}
                  coding_agent_type={session.project?.coding_agent_type ?? ""}
                />
              ) : (
                <MessageStreamPreview
                  key={`${task_revision.id}-${task_revision.status}`}
                  task_revision={task_revision}
                  coding_agent_type={session.project?.coding_agent_type ?? ""}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </MessageActions>
    );
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);

  const session = await cachedGetSessionData(slug);

  return {
    title: `${session.title || session.slug} | Full-Stack App-Builder AI Agent`,
  };
}
