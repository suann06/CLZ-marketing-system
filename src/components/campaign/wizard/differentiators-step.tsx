"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DifferentiatorsStep({
  campaignId,
  campaignName,
  initialDifferentiators,
}: {
  campaignId: string;
  campaignName: string;
  initialDifferentiators: string[];
}) {
  const router = useRouter();

  const [differentiators, setDifferentiators] = useState<string[]>(
    initialDifferentiators.length > 0 ? initialDifferentiators : [""],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateAt(index: number, value: string) {
    setDifferentiators((prev) => prev.map((d, i) => (i === index ? value : d)));
  }

  function removeAt(index: number) {
    setDifferentiators((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setDifferentiators((prev) => [...prev, ""]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const cleaned = differentiators.map((d) => d.trim()).filter((d) => d.length > 0);
    if (cleaned.length === 0) {
      setFormError("Add at least one differentiator before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/differentiators`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ differentiators: cleaned }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(
          typeof body?.error === "string"
            ? body.error
            : "Could not save differentiators. Please try again.",
        );
        return;
      }

      router.push(`/campaigns/${campaignId}/datasets`);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold">{campaignName}</h1>
      <p className="mb-6 text-sm text-gray-500">Step 2 of 6 — Differentiators</p>
      <p className="mb-6 text-sm text-gray-600">
        Add CLZ-specific differentiators for this campaign — angles and advantages beyond the
        official pricing and promotion facts entered in Step 1.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {differentiators.map((value, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={value}
                onChange={(e) => updateAt(index, e.target.value)}
                placeholder="e.g. Free installation within 3 working days"
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
              />
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label="Remove differentiator"
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="self-start rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
        >
          + Add differentiator
        </button>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 self-start rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
