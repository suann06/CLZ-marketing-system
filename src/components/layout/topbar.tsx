"use client";

import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { UserMenu } from "@/components/layout/user-menu";

export function Topbar({
  onOpenMobileNav,
  userEmail,
}: {
  onOpenMobileNav: () => void;
  userEmail: string | null;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="rounded p-1.5 hover:bg-surface-muted md:hidden"
        >
          <span aria-hidden>☰</span>
        </button>
        <Breadcrumbs />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/campaigns/new"
          className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          New Campaign
        </Link>
        <UserMenu email={userEmail} />
      </div>
    </header>
  );
}
