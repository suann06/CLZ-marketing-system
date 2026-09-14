import { notFound, redirect } from "next/navigation";
import { requireHumanActor, UnauthenticatedError } from "@/lib/actor";
import { getCampaignDetail, CampaignNotFoundError } from "@/server/services/campaign-service";
import {
  getCampaignPerformance,
  getDatasetPerformance,
  getCreativePerformance,
} from "@/server/services/campaign-performance-service";

export const dynamic = "force-dynamic";

// Minimal, read-only reporting page — no business logic and no direct
// Prisma access here; every number comes from campaign-performance-service.ts
// (Stage 10), called directly the same way every other server-rendered
// staff page in this app calls its service layer (e.g. campaigns/page.tsx
// -> listCampaigns()), not via an internal fetch to the API route.
function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export default async function CampaignPerformancePage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  try {
    await requireHumanActor();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/login");
    }
    throw err;
  }

  const { campaignId } = await params;

  let detail;
  try {
    detail = await getCampaignDetail(campaignId);
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      notFound();
    }
    throw err;
  }

  const [performance, datasets, creatives] = await Promise.all([
    getCampaignPerformance(campaignId),
    getDatasetPerformance(campaignId),
    getCreativePerformance(campaignId),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold">Campaign Performance</h1>
      <p className="mb-6 text-sm text-gray-500">{detail.campaign.name}</p>

      {/* A. Campaign funnel + conversion rates + sales value */}
      <section className="mb-8 rounded border border-gray-200 p-4">
        <p className="mb-3 text-sm font-medium">Funnel</p>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-gray-500">Ads</p>
            <p className="text-lg font-semibold">{performance.totalAds}</p>
          </div>
          <div>
            <p className="text-gray-500">Clicks</p>
            <p className="text-lg font-semibold">{performance.totalClicks}</p>
          </div>
          <div>
            <p className="text-gray-500">WhatsApp Enquiries</p>
            <p className="text-lg font-semibold">{performance.totalWhatsAppEnquiries}</p>
          </div>
          <div>
            <p className="text-gray-500">Applications</p>
            <p className="text-lg font-semibold">{performance.totalApplications}</p>
          </div>
          <div>
            <p className="text-gray-500">Qualified Leads</p>
            <p className="text-lg font-semibold">{performance.totalQualifiedLeads}</p>
          </div>
          <div>
            <p className="text-gray-500">Won / Lost Sales</p>
            <p className="text-lg font-semibold">
              {performance.wonSales} / {performance.lostSales}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Win Rate</p>
            <p className="text-lg font-semibold">{formatRate(performance.winRate)}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Sales Value (Won)</p>
            <p className="text-lg font-semibold">RM {performance.totalSalesValue}</p>
          </div>
        </div>

        <p className="mt-4 mb-2 text-sm font-medium">Conversion Rates</p>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-gray-500">Click → Enquiry</p>
            <p className="font-medium">{formatRate(performance.conversionRates.clickToEnquiryRate)}</p>
          </div>
          <div>
            <p className="text-gray-500">Enquiry → Application</p>
            <p className="font-medium">{formatRate(performance.conversionRates.enquiryToApplicationRate)}</p>
          </div>
          <div>
            <p className="text-gray-500">Application → Qualified</p>
            <p className="font-medium">{formatRate(performance.conversionRates.applicationToQualifiedRate)}</p>
          </div>
          <div>
            <p className="text-gray-500">Qualified → Sale</p>
            <p className="font-medium">{formatRate(performance.conversionRates.qualifiedToSaleRate)}</p>
          </div>
          <div>
            <p className="text-gray-500">Overall Click → Sale</p>
            <p className="font-medium">{formatRate(performance.conversionRates.overallClickToSaleRate)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          No click-through rate is shown — this system does not capture ad-impression/reach data, only
          clicks, so a CTR cannot be reliably calculated.
        </p>
      </section>

      {/* B. Dataset performance */}
      <section className="mb-8 rounded border border-gray-200 p-4">
        <p className="mb-3 text-sm font-medium">Dataset Performance ({datasets.length})</p>
        {datasets.length === 0 ? (
          <p className="text-sm text-gray-500">No dataset-attributed clicks yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Dataset</th>
                  <th className="py-2 pr-4">Clicks</th>
                  <th className="py-2 pr-4">Enquiries</th>
                  <th className="py-2 pr-4">Applications</th>
                  <th className="py-2 pr-4">Qualified</th>
                  <th className="py-2 pr-4">Won / Lost</th>
                  <th className="py-2 pr-4">Sales Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {datasets.map((d) => (
                  <tr key={d.datasetId}>
                    <td className="py-2 pr-4 font-medium">{d.datasetName}</td>
                    <td className="py-2 pr-4">{d.totalClicks}</td>
                    <td className="py-2 pr-4">{d.totalEnquiries}</td>
                    <td className="py-2 pr-4">{d.totalApplications}</td>
                    <td className="py-2 pr-4">{d.qualifiedLeads}</td>
                    <td className="py-2 pr-4">
                      {d.wonSales} / {d.lostSales}
                    </td>
                    <td className="py-2 pr-4">RM {d.totalSalesValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* C. Creative / content version performance */}
      <section className="rounded border border-gray-200 p-4">
        <p className="mb-3 text-sm font-medium">Creative Performance ({creatives.length})</p>
        {creatives.length === 0 ? (
          <p className="text-sm text-gray-500">No launches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Platform</th>
                  <th className="py-2 pr-4">Content Set</th>
                  <th className="py-2 pr-4">Variant</th>
                  <th className="py-2 pr-4">Clicks</th>
                  <th className="py-2 pr-4">Enquiries</th>
                  <th className="py-2 pr-4">Applications</th>
                  <th className="py-2 pr-4">Qualified</th>
                  <th className="py-2 pr-4">Won / Lost</th>
                  <th className="py-2 pr-4">Sales Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {creatives.map((c) => (
                  <tr key={`${c.contentSetId}-${c.contentSetVersion}-${c.platform}-${c.variantIndex}`}>
                    <td className="py-2 pr-4 font-medium capitalize">{c.platform}</td>
                    <td className="py-2 pr-4">v{c.contentSetVersion}</td>
                    <td className="py-2 pr-4">#{c.variantIndex}</td>
                    <td className="py-2 pr-4">{c.clicks}</td>
                    <td className="py-2 pr-4">{c.enquiries}</td>
                    <td className="py-2 pr-4">{c.applications}</td>
                    <td className="py-2 pr-4">{c.qualifiedLeads}</td>
                    <td className="py-2 pr-4">
                      {c.wonSales} / {c.lostSales}
                    </td>
                    <td className="py-2 pr-4">RM {c.salesValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
