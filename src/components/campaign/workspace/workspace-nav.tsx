"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Dark Olive Luxury IA (approved plan) — Overview / Strategy / Content &
// Creatives / Targeting & Buildings / Performance / Leads / Sales.
// Route mapping notes:
//  - "Overview" still links to /brief (unchanged URL — only the label
//    changed, same as the original Phase 4B rename from "Brief").
//  - "Content & Creatives" is a label-only rename of the existing /content
//    route.
//  - "Targeting & Buildings" is a NEW read-only route (/targeting), not
//    the existing /buildings wizard-edit route — /buildings is gated to
//    draft campaigns only (it redirects confirmed campaigns away), so it
//    can't double as a persistent workspace tab. /targeting reuses
//    getCampaignBrief()'s already-computed dataset/targeting data (the
//    same data the Overview tab used to render inline) and links back to
//    /buildings for editing when the campaign is still a draft.
//  - "Leads" is the existing /leads route (already real — see
//    (workspace)/leads/page.tsx), unchanged.
//  - "Sales" is a new route (/sales) backed by
//    listSalesForCampaign() (lead-query-service.ts), added alongside this
//    nav change.
//  - "Applications" is dropped as a tab — it was already a Phase-4D
//    placeholder page whose own copy says application status lives on the
//    Leads tab; that page is left in place (still directly reachable) but
//    no longer linked from here.
//  - "Launch" is dropped as a tab — it's now a header action (see
//    CampaignWorkspaceHeader); the /launch route itself is unchanged.
const TABS = [
  { segment: "brief", label: "Overview" },
  { segment: "strategy", label: "Strategy" },
  { segment: "content", label: "Content & Creatives" },
  { segment: "targeting", label: "Targeting & Buildings" },
  { segment: "performance", label: "Performance" },
  { segment: "leads", label: "Leads" },
  { segment: "sales", label: "Sales" },
] as const;

export function CampaignWorkspaceNav({ campaignId }: { campaignId: string }) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-surface px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl gap-6 overflow-x-auto">
        {TABS.map((tab) => {
          const href = `/campaigns/${campaignId}/${tab.segment}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.segment}
              href={href}
              className={`-mb-px shrink-0 border-b-2 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-secondary hover:text-foreground"
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
