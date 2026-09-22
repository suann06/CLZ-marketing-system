import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@prisma/client";

// Thin, typed wrapper over the one shared Badge/status.ts mapping.
// ApplicationStatus is exactly: not_started | in_progress | submitted.
export function ApplicationStatusBadge({
  status,
  variant = "pill",
}: {
  status: ApplicationStatus;
  variant?: "pill" | "dot";
}) {
  return (
    <Badge status={status} variant={variant}>
      {status.replace("_", " ")}
    </Badge>
  );
}
