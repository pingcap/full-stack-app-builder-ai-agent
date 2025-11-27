import { useSize } from "@radix-ui/react-use-size";
import { ExternalLinkIcon } from "lucide-react";
import { use, useRef, useState } from "react";
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
}: {
  url: string;
  checkpoints: { index: number; name: string }[];
  index: number;
}) {
  const [navigationContainerElement, setNavigationContainerElement] =
    useState<HTMLDivElement | null>(null);
  const { setPreviewIndex } = use(PreviewIndexContext);

  const size = useSize(navigationContainerElement);

  return (
    <WebPreview className="size-full" defaultUrl={url}>
      <WebPreviewNavigation ref={setNavigationContainerElement}>
        <Select
          value={String(index)}
          onValueChange={(index) => setPreviewIndex(parseInt(index))}
        >
          <SelectTrigger className="max-w-[180px] w-full" size="sm">
            <div className=" overflow-hidden whitespace-nowrap text-ellipsis">
              <SelectValue />
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
                {checkpoint.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <WebPreviewUrl
          disabled={url === ""}
          placeholder={url === "" ? "" : undefined}
        />
        <WebPreviewNavigationButton
          tooltip="Open in browser"
          onClick={() => window.open(url, "_blank")}
        >
          <ExternalLinkIcon />
        </WebPreviewNavigationButton>
      </WebPreviewNavigation>
      <WebPreviewBody src={url === "" ? "about:blank" : undefined} />
    </WebPreview>
  );
}
