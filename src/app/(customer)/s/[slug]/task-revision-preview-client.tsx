import { ExternalLinkIcon } from "lucide-react";
import { use } from "react";
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
  const { setPreviewIndex } = use(PreviewIndexContext);

  return (
    <WebPreview className="size-full" defaultUrl={url}>
      <WebPreviewNavigation>
        <Select
          value={String(index)}
          onValueChange={(index) => setPreviewIndex(parseInt(index))}
        >
          <SelectTrigger className="max-w-[180px] w-full" size="sm">
            <div className=" overflow-hidden whitespace-nowrap text-ellipsis">
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className="w-[var(--radix-popper-anchor-width)]">
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
