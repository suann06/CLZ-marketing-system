"use client";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { UserMenu } from "@/components/layout/user-menu";

// Minimal by design — breadcrumbs and the user menu only. No standing CTA:
// "New Campaign" lives contextually on the pages that need it (Dashboard,
// Campaigns list) instead of being duplicated here on every route. See the
// approved visual identity spec's App Shell / Topbar section.
export function Topbar({
  onOpenMobileNav,
  userEmail,
}: {
  onOpenMobileNav: () => void;
  userEmail: string | null;
}) {
  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-surface-muted px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="rounded-lg p-1.5 text-secondary hover:bg-surface-raised md:hidden"
        >
          <span aria-hidden>☰</span>
        </button>
        <Breadcrumbs />
      </div>
      <UserMenu email={userEmail} />
    </header>
  );
}
