"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/campaign/wizard/wizard-shell";
import type { WizardStepKey } from "@/components/campaign/wizard/wizard-steps";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export type ReviewBuildingGroup = {
  datasetId: string;
  datasetName: string;
  buildingNames: string[];
};

export function ReviewStep({
  campaignId,
  campaignName,
  productPromotion,
  officialPricing,
  differentiators,
  datasetNames,
  buildingGroups,
  totalBuildingCount,
  completedSteps,
}: {
  campaignId: string;
  campaignName: string;
  productPromotion: string;
  officialPricing: { amount?: number; currency?: string; terms?: string };
  differentiators: string[];
  datasetNames: string[];
  buildingGroups: ReviewBuildingGroup[];
  totalBuildingCount: number;
  completedSteps: WizardStepKey[];
}) {
  const router = useRouter();

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/confirm`, {
        method: "POST",
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(
          typeof body?.error === "string" ? body.error : "Could not confirm this campaign. Please try again.",
        );
        setSubmitting(false);
        return;
      }

      router.push("/campaigns");
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <WizardShell
      campaignId={campaignId}
      title={campaignName}
      currentStep={submitting ? "confirm" : "review"}
      completedSteps={completedSteps}
    >
      <div className="flex flex-col gap-6">
        <Card title="Campaign Basics">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Campaign Name</dt>
            <dd>{campaignName}</dd>
            <dt className="text-muted">Product / Promotion</dt>
            <dd>{productPromotion}</dd>
            <dt className="text-muted">Official Pricing</dt>
            <dd>
              {officialPricing.amount ?? "—"} {officialPricing.currency ?? ""}
              {officialPricing.terms ? ` · ${officialPricing.terms}` : ""}
            </dd>
          </dl>
        </Card>

        <Card
          title="Differentiators"
          action={
            <Link href={`/campaigns/${campaignId}/differentiators`} className="text-sm text-muted hover:underline">
              Edit
            </Link>
          }
        >
          {differentiators.length === 0 ? (
            <p className="text-sm text-muted">None added.</p>
          ) : (
            <ul className="list-inside list-disc text-sm">
              {differentiators.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={`Selected Dataset(s) (${datasetNames.length})`}
          action={
            <Link href={`/campaigns/${campaignId}/datasets`} className="text-sm text-muted hover:underline">
              Edit
            </Link>
          }
        >
          {datasetNames.length === 0 ? (
            <p className="text-sm text-muted">None selected.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {datasetNames.map((name) => (
                <li key={name}>
                  <Badge>{name}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={`Selected Buildings (${totalBuildingCount})`}
          action={
            <Link href={`/campaigns/${campaignId}/buildings`} className="text-sm text-muted hover:underline">
              Edit
            </Link>
          }
        >
          {buildingGroups.length === 0 ? (
            <p className="text-sm text-muted">None selected.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {buildingGroups.map((group) => (
                <div key={group.datasetId}>
                  <p className="mb-1 text-sm font-medium text-foreground">
                    {group.datasetName} ({group.buildingNames.length})
                  </p>
                  <ul className="list-inside list-disc text-sm text-muted">
                    {group.buildingNames.map((name, i) => (
                      <li key={i}>{name}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {formError && (
        <div className="mt-4">
          <ErrorState message={formError} />
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Link href={`/campaigns/${campaignId}/buildings`}>
          <Button type="button" variant="secondary" disabled={submitting}>
            Back
          </Button>
        </Link>
        <Button type="button" onClick={handleConfirm} isLoading={submitting}>
          {submitting ? "Confirming…" : "Confirm Campaign"}
        </Button>
      </div>
    </WizardShell>
  );
}
