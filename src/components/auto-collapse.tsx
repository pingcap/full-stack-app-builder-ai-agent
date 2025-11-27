"use client";

import { motion } from "framer-motion";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function AutoCollapse({
  children,
  collapseThresholdHeight = 72,
  className,
  enable = true,
}: {
  children: ReactNode;
  collapseThresholdHeight?: number;
  enable?: boolean;
  className?: string;
}) {
  const [isTooTall, setIsTooTall] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (content && enable) {
      const ro = new ResizeObserver(([entry]) => {
        setIsTooTall(entry!.contentRect.height > collapseThresholdHeight);
      });

      setIsTooTall(content.clientHeight > collapseThresholdHeight);

      ro.observe(content);

      return () => {
        ro.disconnect();
      };
    }
  }, [enable, collapseThresholdHeight]);

  return (
    <motion.div
      className="overflow-hidden relative"
      animate={{
        height:
          enable && isTooTall
            ? collapsed
              ? collapseThresholdHeight
              : "auto"
            : "auto",
      }}
    >
      <div ref={contentRef}>{children}</div>
      {enable && isTooTall && (
        <motion.div
          className={cn(
            "absolute z-0 bottom-0 left-0 w-full bg-gradient-to-t from-secondary/100 to-secondary/0 cursor-pointer flex items-center justify-center pb-1 py-4",
            className,
          )}
          animate={{
            opacity: collapsed ? 1 : 0,
            pointerEvents: collapsed ? "auto" : "none",
          }}
          onClick={() => setCollapsed(false)}
        >
          <ChevronDownIcon className="text-muted-foreground size-4" />
        </motion.div>
      )}
      {enable && isTooTall && (
        <button
          type="button"
          className="w-full flex items-center justify-center py-2 cursor-pointer"
          onClick={() => setCollapsed(true)}
        >
          <ChevronUpIcon className="text-muted-foreground size-4" />
        </button>
      )}
    </motion.div>
  );
}
