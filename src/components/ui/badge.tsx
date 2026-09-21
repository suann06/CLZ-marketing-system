import type { ReactNode } from "react";
import { STATUS_STYLES, isStatusKind } from "@/components/ui/status";

// Accepts either a known StatusKind (colored per the canonical mapping) or
// an arbitrary string (e.g. a platform name) rendered as a neutral pill.
export function Badge({ status, children, className = "" }: { status?: string; children: ReactNode; className?: string }) {
  const style = status && isStatusKind(status) ? STATUS_STYLES[status] : "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style} ${className}`}
    >
      {children}
    </span>
  );
}
