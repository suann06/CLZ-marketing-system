import type { ReactNode } from "react";

// A Card means "this is a genuinely separate object" (a launch platform, an
// editable content variant, a modal-like action area) — not a default
// wrapper for every section. See the approved visual identity spec before
// reaching for this in a new page; a section heading + divider is very
// often the correct choice instead.
export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
