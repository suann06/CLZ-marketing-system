// The single canonical status->color mapping for the whole app. Every page
// that shows a status pill should import this rather than defining its own
// STATUS_STYLES object.
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
  | "archived"
  // FollowUpStatus's remaining state — "pending"/"failed"/"cancelled" are
  // already shared with it.
  | "sent";

// Pill treatment — headers, prominent single-status contexts. Dark-canvas
// formula throughout: a low-opacity tint of the semantic color as the fill,
// the full-strength color as the text — same pattern the approved Stitch
// design uses for its own status/metric pills (e.g. "+18.4%" — a dark
// tinted background with bright text), rather than the light-mode
// pale-bg/dark-text pairing this replaces. Colors route through the
// --success/--warning/--error design tokens (globals.css) where a semantic
// match exists; plain Tailwind blue/gray fill the remaining families
// (info-ish and neutral) the token system doesn't have a dedicated token for.
export const STATUS_STYLES: Record<StatusKind, string> = {
  draft: "bg-gray-500/15 text-gray-300",
  needs_review: "bg-warning/15 text-warning",
  approved: "bg-blue-500/15 text-blue-300",
  live: "bg-success/15 text-success",
  pending: "bg-gray-500/15 text-gray-300",
  launching: "bg-blue-500/15 text-blue-300",
  failed: "bg-error/15 text-error",
  cancelled: "bg-gray-500/10 text-gray-500",
  completed: "bg-success/15 text-success",
  not_started: "bg-gray-500/15 text-gray-300",
  in_progress: "bg-warning/15 text-warning",
  submitted: "bg-blue-500/15 text-blue-300",
  new: "bg-gray-500/15 text-gray-300",
  hot: "bg-error/15 text-error",
  warm: "bg-warning/15 text-warning",
  cold: "bg-blue-500/15 text-blue-300",
  won: "bg-success/15 text-success",
  lost: "bg-gray-500/15 text-gray-400",
  confirmed: "bg-blue-500/15 text-blue-300",
  content_ready: "bg-warning/15 text-warning",
  active: "bg-success/15 text-success",
  closed: "bg-gray-500/10 text-gray-500",
  archived: "bg-gray-500/10 text-gray-500",
  sent: "bg-success/15 text-success",
};

// Dot treatment — dense tables (LeadTable, ComparisonTable, campaign lists).
// A solid-fill colour matching STATUS_STYLES' own semantic family, used as
// a small 6px indicator next to a plain-text label instead of a full pill —
// see the approved visual identity spec, "status badges" section.
export const STATUS_DOT_STYLES: Record<StatusKind, string> = {
  draft: "bg-gray-400",
  needs_review: "bg-warning",
  approved: "bg-blue-400",
  live: "bg-success",
  pending: "bg-gray-400",
  launching: "bg-blue-400",
  failed: "bg-error",
  cancelled: "bg-gray-600",
  completed: "bg-success",
  not_started: "bg-gray-400",
  in_progress: "bg-warning",
  submitted: "bg-blue-400",
  new: "bg-gray-400",
  hot: "bg-error",
  warm: "bg-warning",
  cold: "bg-blue-400",
  won: "bg-success",
  lost: "bg-gray-500",
  confirmed: "bg-blue-400",
  content_ready: "bg-warning",
  active: "bg-success",
  closed: "bg-gray-600",
  archived: "bg-gray-600",
  sent: "bg-success",
};

export function isStatusKind(value: string): value is StatusKind {
  return value in STATUS_STYLES;
}
