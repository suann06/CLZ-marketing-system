"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export type CampaignListItem = {
  id: string;
  name: string;
  productPromotion: string;
  status: string;
  startDateLabel: string;
  endDateLabel: string;
  href: string;
  totalLeads: number;
  wonSales: number;
  lostSales: number;
  totalSalesValue: string;
};

// Client-side search/filter only — over the exact list already fetched by
// listCampaigns() in page.tsx. No new query params, no new data source; name/
// product-promotion/status are the only fields the list already carries.
export function CampaignList({ campaigns }: { campaigns: CampaignListItem[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const statuses = useMemo(
    () => Array.from(new Set(campaigns.map((c) => c.status))).sort(),
    [campaigns],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      const matchesSearch =
        q.length === 0 || c.name.toLowerCase().includes(q) || c.productPromotion.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [campaigns, search, statusFilter]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or product/promotion…"
          aria-label="Search campaigns"
          className="sm:max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="sm:w-48"
        >
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No campaigns match your search"
          description="Try a different name, product/promotion, or status filter."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-surface-muted text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Product / promotion</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Leads</th>
                <th className="px-4 py-3 text-right font-medium">Won / Lost</th>
                <th className="px-4 py-3 text-right font-medium">Sales value</th>
                <th className="px-4 py-3 font-medium">Start date</th>
                <th className="px-4 py-3 font-medium">End date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((campaign) => (
                <tr key={campaign.id} className="transition-colors duration-150 hover:bg-surface-raised">
                  <td className="px-4 py-3.5 font-medium text-foreground">
                    <Link href={campaign.href} className="hover:underline">
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-secondary">{campaign.productPromotion}</td>
                  <td className="px-4 py-3.5">
                    <Badge variant="dot" status={campaign.status}>
                      {campaign.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">
                    {campaign.totalLeads}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">
                    {campaign.wonSales} / {campaign.lostSales}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">
                    RM {campaign.totalSalesValue}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-muted">{campaign.startDateLabel}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-muted">{campaign.endDateLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
