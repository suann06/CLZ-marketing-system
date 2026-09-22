import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignNotFoundError } from "@/server/services/campaign-service";
import {
  getCampaignPerformance,
  getDatasetPerformance,
  getCreativePerformance,
  getSalesTimeSeries,
} from "@/server/services/campaign-performance-service";
import { Button } from "@/components/ui/button";
import { MetricBand } from "@/components/ui/metric-band";
import { FunnelChart } from "@/components/ui/funnel-chart";
import { ConversionAnalysis } from "@/components/performance/conversion-analysis";
import { DatasetComparison } from "@/components/performance/dataset-comparison";
import { CreativeComparison } from "@/components/performance/creative-comparison";
import { SalesTimeSeries } from "@/components/performance/sales-time-series";

export const dynamic = "force-dynamic";

// Analytical workspace ("how did this campaign perform, and where does
// the funnel lose volume") — distinct in purpose from the Dashboard
// (operational) and Feedback (learning/advisory) pages it links to/from.
// No business logic and no direct Prisma access here; every number comes
// from campaign-performance-service.ts, called directly the same way
// every other server-rendered staff page calls its service layer. The
// campaign name/status/dates header already comes from the (workspace)
// layout, so this page doesn't repeat it. No section is wrapped in a
// bordered Card — a heading is enough; this should read as one analytical
// document, not a stack of dashboard modules.
export default async function CampaignPerformancePage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  let performance;
  try {
    performance = await getCampaignPerformance(campaignId);
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      notFound();
    }
    throw err;
  }

  const [datasets, creatives, salesTimeSeries] = await Promise.all([
    getDatasetPerformance(campaignId),
    getCreativePerformance(campaignId),
    getSalesTimeSeries(campaignId),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Performance</h2>
          <p className="mt-1 text-sm text-secondary">Analytical view of this campaign&apos;s funnel and outcomes.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/campaigns/${campaignId}/leads`}>
            <Button type="button" variant="secondary">
              ← Back to Leads
            </Button>
          </Link>
          <Link href="/feedback">
            <Button type="button" variant="secondary">
              View Feedback →
            </Button>
          </Link>
        </div>
      </div>

      <MetricBand
        className="mb-12"
        items={[
          { label: "Sales value", value: `RM ${performance.totalSalesValue}`, hero: true },
          { label: "Clicks", value: String(performance.totalClicks) },
          { label: "Applications", value: String(performance.totalApplications) },
          { label: "Won / lost", value: `${performance.wonSales} / ${performance.lostSales}` },
        ]}
      />

      <div className="mb-12">
        <h2 className="mb-5 text-lg font-semibold text-foreground">Marketing funnel</h2>
        <FunnelChart
          stages={[
            { key: "ads", label: "Ads", count: performance.totalAds },
            { key: "clicks", label: "Clicks", count: performance.totalClicks, rate: null },
            {
              key: "enquiries",
              label: "WhatsApp Enquiries",
              count: performance.totalWhatsAppEnquiries,
              rate: performance.conversionRates.clickToEnquiryRate,
            },
            {
              key: "applications",
              label: "Applications",
              count: performance.totalApplications,
              rate: performance.conversionRates.enquiryToApplicationRate,
            },
            {
              key: "qualified",
              label: "Qualified",
              count: performance.totalQualifiedLeads,
              rate: performance.conversionRates.applicationToQualifiedRate,
            },
            {
              key: "sales",
              label: "Sales",
              count: performance.totalSales,
              rate: performance.conversionRates.qualifiedToSaleRate,
            },
          ]}
        />
      </div>

      <div className="mb-12">
        <ConversionAnalysis rates={performance.conversionRates} />
      </div>

      <div className="mb-12">
        <DatasetComparison datasets={datasets} />
      </div>

      <div className="mb-12">
        <CreativeComparison creatives={creatives} />
      </div>

      <SalesTimeSeries points={salesTimeSeries} />
    </div>
  );
}
