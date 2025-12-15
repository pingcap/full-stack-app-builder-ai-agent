import { useSize } from "@radix-ui/react-use-size";
import { ExternalLinkIcon, Monitor, RefreshCcwIcon } from "lucide-react";
import { type ReactNode, use, useState } from "react";
import { PreviewIndexContext } from "@/app/(customer)/s/[slug]/preview-index-provider";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export function TaskRevisionPreviewClient({
  url,
  checkpoints,
  index,
  error,
}: {
  url: string;
  error?: ReactNode;
  checkpoints: { index: number; name: string }[];
  index: number;
}) {
  const [navigationContainerElement, setNavigationContainerElement] =
    useState<HTMLDivElement | null>(null);
  const { setPreviewIndex } = use(PreviewIndexContext);
  const [iframeRef, setIframeRef] = useState<HTMLIFrameElement | null>(null);
  const selectTriggerId = `task-revision-checkpoint-select-${index}`;
  const selectContentId = `${selectTriggerId}-content`;

  const size = useSize(navigationContainerElement);

  return (
    <WebPreview className="size-full overflow-hidden" defaultUrl={url}>
      <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/40">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {["bg-red-400", "bg-yellow-400", "bg-green-400"].map((color) => (
              <span
                key={color}
                className={`h-2.5 w-2.5 rounded-full ${color}`}
              />
            ))}
          </div>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </span>
        </div>
        <Monitor className="h-4 w-4 text-muted-foreground" />
      </div>
      <WebPreviewNavigation ref={setNavigationContainerElement}>
        <Select
          value={String(index)}
          onValueChange={(index) => setPreviewIndex(parseInt(index, 10))}
        >
          <SelectTrigger
            id={selectTriggerId}
            aria-controls={selectContentId}
            className="max-w-[180px] w-full"
            size="sm"
          >
            <div className="overflow-hidden whitespace-nowrap text-ellipsis">
              {checkpoints[index]?.name}
            </div>
          </SelectTrigger>
          <SelectContent
            id={selectContentId}
            style={{ width: size?.width ? size.width - 16 : 180 }}
            align="start"
          >
            {checkpoints.map((checkpoint) => (
              <SelectItem
                key={checkpoint.index}
                value={String(checkpoint.index)}
              >
                <div className="size-full line-clamp-3">{checkpoint.name}</div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <WebPreviewUrl
          disabled={url === ""}
          placeholder={url === "" ? "" : undefined}
        />
        <WebPreviewNavigationButton
          tooltip="Refresh"
          disabled={iframeRef == null}
          onClick={() => {
            if (iframeRef) {
              const src = iframeRef.src;
              iframeRef.src = "";
              iframeRef.src = src;
            }
          }}
        >
          <RefreshCcwIcon />
        </WebPreviewNavigationButton>
        <WebPreviewNavigationButton
          tooltip="Open in browser"
          disabled={iframeRef == null}
          onClick={() => window.open(url, "_blank")}
        >
          <ExternalLinkIcon />
        </WebPreviewNavigationButton>
      </WebPreviewNavigation>
      {error != null ? (
        <div className="flex-1 w-full overflow-hidden">
          <div className="size-full p-4 flex items-start justify-start flex-col gap-4 text-left">
            {error}
          </div>
        </div>
      ) : (
        <WebPreviewBody
          ref={setIframeRef}
          src={url === "" ? "about:blank" : undefined}
        />
      )}
    </WebPreview>
  );
}
