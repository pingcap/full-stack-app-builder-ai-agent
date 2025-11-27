import { ExternalLinkIcon } from "lucide-react";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";

export function TaskRevisionPreviewClient({ url }: { url: string }) {
  return (
    <div className="flex size-full flex-col rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-[#FF5F57]" />
          <span className="size-3 rounded-full bg-[#FEBE2E]" />
          <span className="size-3 rounded-full bg-[#28C840]" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          Live Preview
        </span>
      </div>
      <WebPreview
        className="flex-1 rounded-none border-0 bg-transparent"
        defaultUrl={url}
      >
        <WebPreviewNavigation>
          <WebPreviewUrl />
          <WebPreviewNavigationButton
            tooltip="Open in browser"
            onClick={() => window.open(url, "_blank")}
          >
            <ExternalLinkIcon />
          </WebPreviewNavigationButton>
        </WebPreviewNavigation>
        <WebPreviewBody />
      </WebPreview>
    </div>
  );
}
