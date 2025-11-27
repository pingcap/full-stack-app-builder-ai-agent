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
    <WebPreview className="size-full" defaultUrl={url}>
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
  );
}
