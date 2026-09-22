import { Badge } from "@/components/ui/badge";
import type { SaleStatus } from "@prisma/client";

// Thin, typed wrapper over the one shared Badge/status.ts mapping.
// SaleStatus is exactly: won | lost.
export function SaleStatusBadge({ status, variant = "pill" }: { status: SaleStatus; variant?: "pill" | "dot" }) {
  return (
    <Badge status={status} variant={variant}>
      {status}
    </Badge>
  );
}
