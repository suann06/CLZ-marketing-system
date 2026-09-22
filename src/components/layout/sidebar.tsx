"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ICON_BY_HREF } from "@/components/layout/nav-icons";

// Phase 4D added the Customer group (/leads, /applications, /sales) and
// Phase 4F added global /performance now that both it and /feedback are
// real pages. Still intentionally sparse otherwise: Datasets/Activity/
// Settings have no page at all yet. Adding nav entries for pages that
// don't exist would mean dead links, which the approved proposal
// explicitly ruled out. Phase 6 (Dark Olive Luxury visual migration)
// restyles this nav but keeps this exact link set — Stitch's sidebar shows
// a few extra items (WhatsApp, Datasets, AI Studio) that don't have real
// pages here, and those are deliberately not added.
const NAV_GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard" }] },
  { label: "Marketing", items: [{ href: "/campaigns", label: "Campaigns" }] },
  {
    label: "Customer",
    items: [
      { href: "/leads", label: "Leads" },
      { href: "/applications", label: "Applications" },
      { href: "/sales", label: "Sales" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/performance", label: "Performance" },
      { href: "/feedback", label: "Feedback" },
    ],
  },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted uppercase">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = NAV_ICON_BY_HREF[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-150 ${
                    isActive
                      ? "border border-primary/20 bg-accent-subtle font-semibold text-primary"
                      : "border border-transparent text-secondary hover:bg-surface hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon className={isActive ? "text-primary" : "text-muted"} />}
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
    <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-border bg-surface-muted px-3.5 py-5 md:flex">
      <div className="flex flex-col">
        <div className="mb-6 flex items-center gap-3 px-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-accent-subtle text-primary shadow-[0_0_12px_rgba(132,165,129,0.15)]"
            aria-hidden
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
            </svg>
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-foreground">CLZ Resources</span>
            <span className="mt-0.5 w-fit rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-primary uppercase">
              AI Marketing OS
            </span>
          </div>
        </div>
        <SidebarNav />
      </div>
    </aside>
  );
}
