"use client";

import { useMemo, useState } from "react";
import type { ApplicationStatus, LeadStatus } from "@prisma/client";
import { LeadFilters } from "@/components/lead/lead-filters";
import { LeadTable, type LeadRow } from "@/components/lead/lead-table";

// Owns filter state and does the actual filtering — client-side, over the
// exact list the caller's page.tsx already fetched in one query (see
// lead-query-service.ts). No new query per filter change. Reused by both
// the global /leads page (showCampaign + a campaign dropdown) and every
// campaign-scoped /campaigns/:id/leads page (showCampaign false, no
// campaign dropdown) — one Lead list UI, not two.
export function LeadListView({
  leads,
  basePath,
  showCampaign,
  campaigns,
}: {
  leads: LeadRow[];
  basePath: string;
  showCampaign: boolean;
  campaigns?: { id: string; name: string }[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | "all">("all");
  const [campaignId, setCampaignId] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch =
        q.length === 0 || (lead.name ?? "").toLowerCase().includes(q) || lead.phone.toLowerCase().includes(q);
      const matchesStatus = status === "all" || lead.status === status;
      const matchesApplication = applicationStatus === "all" || lead.applicationStatus === applicationStatus;
      const matchesCampaign = campaignId === "all" || lead.campaign?.id === campaignId;
      return matchesSearch && matchesStatus && matchesApplication && matchesCampaign;
    });
  }, [leads, search, status, applicationStatus, campaignId]);

  return (
    <div>
      <LeadFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        applicationStatus={applicationStatus}
        onApplicationStatusChange={setApplicationStatus}
        campaigns={showCampaign ? campaigns : undefined}
        campaignId={campaignId}
        onCampaignChange={showCampaign ? setCampaignId : undefined}
      />
      <LeadTable
        leads={filtered}
        basePath={basePath}
        showCampaign={showCampaign}
        emptyTitle={leads.length === 0 ? "No leads yet" : "No leads match your filters"}
        emptyDescription={
          leads.length === 0
            ? "Leads appear here once a customer messages in on WhatsApp."
            : "Try a different search, status, or filter."
        }
      />
    </div>
  );
}
