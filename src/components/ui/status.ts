// The single canonical status→color mapping for the whole app. Every page
// that shows a status pill should import this rather than defining its own
// STATUS_STYLES object (as campaigns/page.tsx, leads/page.tsx, and
// leads/[leadId]/page.tsx each currently do, independently, with slightly
// different color choices for the same underlying concepts).
export type StatusKind =
  | "draft"
  | "needs_review"
  | "approved"
  | "live"
  | "pending"
  | "launching"
  | "failed"
  | "cancelled"
  | "completed"
  | "not_started"
  | "in_progress"
  | "submitted"
  | "new"
  | "hot"
  | "warm"
  | "cold"
  | "won"
  | "lost"
  // Campaign lifecycle states (Campaign.status) not otherwise covered above —
  // "draft" and "live" are already shared with it.
  | "confirmed"
  | "content_ready"
  | "active"
  | "closed"
  // MarketingStrategyStatus/ContentSetStatus's third state — "draft" and
  // "approved" are already shared with them.
  | "archived";

export const STATUS_STYLES: Record<StatusKind, string> = {
  draft: "bg-gray-100 text-gray-700",
  needs_review: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-700",
  live: "bg-green-100 text-green-700",
  pending: "bg-gray-100 text-gray-700",
  launching: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
  completed: "bg-green-100 text-green-700",
  not_started: "bg-gray-100 text-gray-700",
  in_progress: "bg-amber-100 text-amber-800",
  submitted: "bg-blue-100 text-blue-700",
  new: "bg-gray-100 text-gray-700",
  hot: "bg-red-100 text-red-700",
  warm: "bg-amber-100 text-amber-800",
  cold: "bg-blue-100 text-blue-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-gray-100 text-gray-500",
  confirmed: "bg-blue-100 text-blue-700",
  content_ready: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-400",
  archived: "bg-gray-100 text-gray-400",
};

export function isStatusKind(value: string): value is StatusKind {
  return value in STATUS_STYLES;
}
