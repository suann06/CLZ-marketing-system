import { Badge } from "@/components/ui/badge";
import type { LeadStatus } from "@prisma/client";

// Thin, typed wrapper over the one shared Badge/status.ts mapping — never
// a second color mapping. LeadStatus is exactly: new | hot | warm | cold.
export function LeadStatusBadge({ status, variant = "pill" }: { status: LeadStatus; variant?: "pill" | "dot" }) {
  return (
    <Badge status={status} variant={variant}>
      {status}
    </Badge>
  );
}
