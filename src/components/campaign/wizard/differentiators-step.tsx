"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/campaign/wizard/wizard-shell";
import type { WizardStepKey } from "@/components/campaign/wizard/wizard-steps";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export function DifferentiatorsStep({
  campaignId,
  campaignName,
  initialDifferentiators,
  completedSteps,
}: {
  campaignId: string;
  campaignName: string;
  initialDifferentiators: string[];
  completedSteps: WizardStepKey[];
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
    <WizardShell campaignId={campaignId} title={campaignName} currentStep="differentiators" completedSteps={completedSteps}>
      <p className="mb-6 text-sm text-muted">
        Add CLZ-specific differentiators for this campaign — angles and advantages beyond the
        official pricing and promotion facts entered in Basics.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card title="Differentiators">
          <div className="flex flex-col gap-2">
            {differentiators.map((value, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={value}
                  onChange={(e) => updateAt(index, e.target.value)}
                  placeholder="e.g. Free installation within 3 working days"
                  className="flex-1"
                />
                <Button type="button" variant="secondary" onClick={() => removeAt(index)} aria-label="Remove differentiator">
                  ×
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={addRow}>
            + Add differentiator
          </Button>
        </Card>

        {formError && <ErrorState message={formError} />}

        <div>
          <Button type="submit" isLoading={submitting}>
            {submitting ? "Saving…" : "Continue"}
          </Button>
        </div>
      </form>
    </WizardShell>
  );
}
