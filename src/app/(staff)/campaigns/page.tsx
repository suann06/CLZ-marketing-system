import Link from "next/link";
import { listCampaigns, resumeCampaignPath } from "@/server/services/campaign-service";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CampaignList, type CampaignListItem } from "@/components/campaign/campaign-list";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(date);
}

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();

  const items: CampaignListItem[] = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    productPromotion: campaign.productPromotion,
    status: campaign.status,
    startDateLabel: formatDate(campaign.startDate),
    endDateLabel: formatDate(campaign.endDate),
    href: resumeCampaignPath(campaign),
  }));

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Campaigns</h1>
        <div className="flex items-center gap-3">
          <Link href="/feedback" className="text-sm underline">
            Feedback
          </Link>
          <Link href="/campaigns/new">
            <Button type="button">New Campaign</Button>
          </Link>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to get started."
          action={
            <Link href="/campaigns/new">
              <Button type="button">New Campaign</Button>
            </Link>
          }
        />
      ) : (
        <CampaignList campaigns={items} />
      )}
    </PageContainer>
  );
}
