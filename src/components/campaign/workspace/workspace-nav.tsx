"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// "Overview" links to the existing /brief route (unchanged URL — only the
// page's own content/heading was redesigned from "Brief" to "Overview", see
// (workspace)/brief/page.tsx) so nothing that already links to /brief breaks.
const TABS = [
  { segment: "brief", label: "Overview" },
  { segment: "strategy", label: "Strategy" },
  { segment: "content", label: "Content" },
  { segment: "launch", label: "Launch" },
  { segment: "leads", label: "Leads" },
  { segment: "applications", label: "Applications" },
  { segment: "performance", label: "Performance" },
] as const;

export function CampaignWorkspaceNav({ campaignId }: { campaignId: string }) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-surface px-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const href = `/campaigns/${campaignId}/${tab.segment}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.segment}
              href={href}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
