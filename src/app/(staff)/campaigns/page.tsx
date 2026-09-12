import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHumanActor, UnauthenticatedError } from "@/lib/actor";
import { listCampaigns, resumeCampaignPath } from "@/server/services/campaign-service";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(date);
}

export default async function CampaignsPage() {
  try {
    await requireHumanActor();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/login");
    }
    throw err;
  }

  const campaigns = await listCampaigns();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Campaigns</h1>
        <Link
          href="/campaigns/new"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 px-6 py-16 text-center text-sm text-gray-500">
          <p>No campaigns yet.</p>
          <p className="mt-1">Create your first campaign to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Product / Promotion</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">End Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={resumeCampaignPath(campaign)} className="hover:underline">
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{campaign.productPromotion}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium capitalize">
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDate(campaign.startDate)}</td>
                  <td className="px-4 py-3">{formatDate(campaign.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
