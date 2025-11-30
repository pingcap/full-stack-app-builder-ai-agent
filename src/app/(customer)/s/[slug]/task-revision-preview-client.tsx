import { useSize } from "@radix-ui/react-use-size";
import { ExternalLinkIcon, RefreshCcwIcon } from "lucide-react";
import { type ReactNode, use, useRef, useState } from "react";
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
  SelectValue,
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

  const size = useSize(navigationContainerElement);

  return (
    <WebPreview className="size-full overflow-hidden" defaultUrl={url}>
      <WebPreviewNavigation ref={setNavigationContainerElement}>
        <Select
          value={String(index)}
          onValueChange={(index) => setPreviewIndex(parseInt(index))}
        >
          <SelectTrigger className="max-w-[180px] w-full" size="sm">
            <div className="overflow-hidden whitespace-nowrap text-ellipsis">
              {checkpoints[index]?.name}
            </div>
          </SelectTrigger>
          <SelectContent
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
          <div className="size-full p-4 flex items-center justify-center flex-col gap-4">
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
