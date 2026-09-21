"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Intentionally sparse in Phase 4A: only groups/links to pages that
// actually exist today. Leads/Applications/Sales/Performance are currently
// campaign-scoped only (no standalone top-level page yet — that's Phase
// 4D/4F work per the approved proposal); Datasets/Activity/Settings have
// no page at all yet. Adding nav entries for pages that don't exist would
// mean dead links, which the approved proposal explicitly ruled out.
const NAV_GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard" }] },
  { label: "Marketing", items: [{ href: "/campaigns", label: "Campaigns" }] },
  { label: "Analytics", items: [{ href: "/feedback", label: "Feedback" }] },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-muted">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`rounded px-3 py-2 text-sm ${
                    isActive
                      ? "bg-surface-muted font-medium text-foreground"
                      : "text-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface px-3 py-6 md:flex">
      <p className="mb-6 px-3 text-sm font-semibold">CLZ Marketing OS</p>
      <SidebarNav />
    </aside>
  );
}
