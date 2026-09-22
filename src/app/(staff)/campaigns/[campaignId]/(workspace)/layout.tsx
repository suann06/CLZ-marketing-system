import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getCampaignDetail, CampaignNotFoundError } from "@/server/services/campaign-service";
import { getCampaignPerformance } from "@/server/services/campaign-performance-service";
import { CampaignWorkspaceHeader } from "@/components/campaign/workspace/workspace-header";
import { CampaignWorkspaceNav } from "@/components/campaign/workspace/workspace-nav";
import type { StatusKind } from "@/components/ui/status";

export const dynamic = "force-dynamic";

// Persistent header + tab nav shared by every workspace tab — Overview
// (brief)/Strategy/Content & Creatives (content)/Targeting & Buildings
// (targeting)/Performance/Leads/Sales, per the approved Dark Olive Luxury
// IA (see workspace-nav.tsx) — kept out of buildings/datasets/
// differentiators/review (the Phase 4C creation wizard) by living in this
// (workspace) route group, which does not affect the URL. Read-only: fetches
// campaign detail + the already-built campaign-performance-service.ts once
// per request and passes results down; no new backend logic.
export default async function CampaignWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  let detail;
  let performance;
  try {
    [detail, performance] = await Promise.all([
      getCampaignDetail(campaignId),
      getCampaignPerformance(campaignId),
    ]);
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      notFound();
    }
    throw err;
  }

  const { campaign } = detail;

  return (
    <div className="flex min-h-full flex-col">
      <CampaignWorkspaceHeader
        campaignId={campaignId}
        name={campaign.name}
        productPromotion={campaign.productPromotion}
        status={campaign.status as StatusKind}
        startDate={campaign.startDate}
        endDate={campaign.endDate}
        metrics={[
          { label: "Clicks", value: String(performance.totalClicks) },
          { label: "WhatsApp Enquiries", value: String(performance.totalWhatsAppEnquiries) },
          { label: "Applications", value: String(performance.totalApplications) },
          { label: "Qualified Leads", value: String(performance.totalQualifiedLeads) },
          { label: "Won Sales", value: `${performance.wonSales} (RM ${performance.totalSalesValue})` },
          { label: "Win Rate", value: `${(performance.winRate * 100).toFixed(1)}%` },
        ]}
      />
      <CampaignWorkspaceNav campaignId={campaignId} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
