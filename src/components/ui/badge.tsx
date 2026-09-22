import type { ReactNode } from "react";
import { STATUS_STYLES, STATUS_DOT_STYLES, isStatusKind } from "@/components/ui/status";

// `variant="pill"` (default) for headers and other prominent, single-status
// contexts. `variant="dot"` for dense tables — a small solid dot + plain
// text instead of a full colourful pill, so a table of 20 rows doesn't
// read as 20 pieces of candy. Same underlying status->color mapping either
// way (status.ts) — never a second colour system.
export function Badge({
  status,
  variant = "pill",
  children,
  className = "",
}: {
  status?: string;
  variant?: "pill" | "dot";
  children: ReactNode;
  className?: string;
}) {
  const known = status && isStatusKind(status);

  if (variant === "dot") {
    const dotClass = known ? STATUS_DOT_STYLES[status] : "bg-muted";
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm text-foreground capitalize ${className}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        {children}
      </span>
    );
  }

  const pillClass = known ? STATUS_STYLES[status] : "bg-gray-500/15 text-gray-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${pillClass} ${className}`}
    >
      {children}
    </span>
  );
}
