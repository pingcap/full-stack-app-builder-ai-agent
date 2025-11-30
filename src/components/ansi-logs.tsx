import { parse } from "ansicolor";
import { useMemo } from "react";

export function AnsiLogs({ raw }: { raw: string }) {
  const parsed = useMemo(() => {
    const { spans } = parse(raw);

    return spans
      .map(
        (span) => `<span style="${span.css}">${escapeHtml(span.text)}</span>`,
      )
      .join("");
  }, [raw]);

  return (
    <div className="whitespace-pre-wrap text-xs font-mono">
      {/** biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation> */}
      <span dangerouslySetInnerHTML={{ __html: parsed }} />
    </div>
  );
}

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
