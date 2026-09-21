"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Generic, URL-segment-based breadcrumb — deliberately does not fetch a
// campaign/lead name (that would mean an extra query on every single
// route). Dynamic (UUID) segments are shown shortened rather than blank.
// A name-aware breadcrumb can be layered on top once the Campaign
// Workspace header exists (Phase 4B/4C) and already has that data loaded.
function segmentLabel(segment: string): string {
  if (UUID_RE.test(segment)) return `${segment.slice(0, 8)}…`;
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-sm font-medium text-foreground">Dashboard</span>;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm text-muted">
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        return (
          <span key={href} className="flex shrink-0 items-center gap-1">
            {index > 0 && <span aria-hidden>/</span>}
            {isLast ? (
              <span className="font-medium text-foreground">{segmentLabel(segment)}</span>
            ) : (
              <Link href={href} className="hover:text-foreground">
                {segmentLabel(segment)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
