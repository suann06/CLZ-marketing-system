"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
}: {
  campaignId: string;
  campaignName: string;
  productPromotion: string;
  officialPricing: { amount?: number; currency?: string; terms?: string };
  differentiators: string[];
  datasetNames: string[];
  buildingGroups: ReviewBuildingGroup[];
  totalBuildingCount: number;
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
        return;
      }

      router.push("/campaigns");
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold">{campaignName}</h1>
      <p className="mb-6 text-sm text-gray-500">Step 5 of 6 — Review Campaign</p>

      <div className="flex flex-col gap-6">
        <section className="rounded border border-gray-200 p-4">
          <p className="mb-2 text-sm font-medium">Campaign Basics</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-500">Campaign Name</dt>
            <dd>{campaignName}</dd>
            <dt className="text-gray-500">Product / Promotion</dt>
            <dd>{productPromotion}</dd>
            <dt className="text-gray-500">Official Pricing</dt>
            <dd>
              {officialPricing.amount ?? "—"} {officialPricing.currency ?? ""}
              {officialPricing.terms ? ` · ${officialPricing.terms}` : ""}
            </dd>
          </dl>
        </section>

        <section className="rounded border border-gray-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Differentiators</p>
            <Link
              href={`/campaigns/${campaignId}/differentiators`}
              className="text-sm text-gray-500 hover:underline"
            >
              Edit
            </Link>
          </div>
          {differentiators.length === 0 ? (
            <p className="text-sm text-gray-500">None added.</p>
          ) : (
            <ul className="list-inside list-disc text-sm">
              {differentiators.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded border border-gray-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Selected Dataset(s) ({datasetNames.length})</p>
            <Link
              href={`/campaigns/${campaignId}/datasets`}
              className="text-sm text-gray-500 hover:underline"
            >
              Edit
            </Link>
          </div>
          {datasetNames.length === 0 ? (
            <p className="text-sm text-gray-500">None selected.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {datasetNames.map((name) => (
                <li
                  key={name}
                  className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white"
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded border border-gray-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">
              Selected Buildings ({totalBuildingCount})
            </p>
            <Link
              href={`/campaigns/${campaignId}/buildings`}
              className="text-sm text-gray-500 hover:underline"
            >
              Edit
            </Link>
          </div>
          {buildingGroups.length === 0 ? (
            <p className="text-sm text-gray-500">None selected.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {buildingGroups.map((group) => (
                <div key={group.datasetId}>
                  <p className="mb-1 text-sm font-medium text-gray-700">
                    {group.datasetName} ({group.buildingNames.length})
                  </p>
                  <ul className="list-inside list-disc text-sm text-gray-600">
                    {group.buildingNames.map((name, i) => (
                      <li key={i}>{name}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {formError && <p className="mt-4 text-sm text-red-600">{formError}</p>}

      <div className="mt-6 flex items-center gap-3">
        <Link
          href={`/campaigns/${campaignId}/buildings`}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Back
        </Link>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Confirming…" : "Confirm Campaign"}
        </button>
      </div>
    </div>
  );
}
