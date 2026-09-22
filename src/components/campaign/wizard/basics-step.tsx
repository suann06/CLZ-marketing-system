"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { campaignBasicsSchema } from "@/server/validation/campaign-schema";
import { WizardShell } from "@/components/campaign/wizard/wizard-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

type FieldErrors = Partial<Record<"name" | "productPromotion" | "officialPricing" | "startDate" | "endDate", string[]>>;

export function BasicsStep() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [productPromotion, setProductPromotion] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("MYR");
  const [terms, setTerms] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const candidate = {
      name,
      productPromotion,
      officialPricing: {
        amount: Number(amount),
        currency,
        terms: terms.trim() ? terms : undefined,
      },
      startDate,
      endDate,
    };

    const parsed = campaignBasicsSchema.safeParse(candidate);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as FieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.error?.fieldErrors) {
          setFieldErrors(body.error.fieldErrors as FieldErrors);
        } else {
          setFormError(
            typeof body?.error === "string" ? body.error : "Could not create the campaign. Please try again.",
          );
        }
        return;
      }

      const { campaign } = (await res.json()) as { campaign: { id: string } };
      router.push(`/campaigns/${campaign.id}/differentiators`);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WizardShell campaignId={null} title="Campaign Basics" currentStep="basics" completedSteps={[]}>
      <form onSubmit={handleSubmit}>
        <Card className="!p-8">
          <div className="flex flex-col divide-y divide-border">
            <div className="flex flex-col gap-5 pb-7">
              <Input
                id="name"
                label="Campaign name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={fieldErrors.name?.[0]}
              />
              <Input
                id="productPromotion"
                label="Product / promotion"
                value={productPromotion}
                onChange={(e) => setProductPromotion(e.target.value)}
                error={fieldErrors.productPromotion?.[0]}
              />
            </div>

            <div className="flex flex-col gap-5 py-7">
              <h3 className="text-sm font-semibold text-foreground">Official pricing</h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input
                  id="amount"
                  label="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <Input id="currency" label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
              <Input id="terms" label="Terms (optional)" value={terms} onChange={(e) => setTerms(e.target.value)} />
              {fieldErrors.officialPricing && (
                <p className="text-sm text-error">{fieldErrors.officialPricing[0]}</p>
              )}
            </div>

            <div className="flex flex-col gap-5 pt-7">
              <h3 className="text-sm font-semibold text-foreground">Schedule</h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input
                  id="startDate"
                  label="Start date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  error={fieldErrors.startDate?.[0]}
                />
                <Input
                  id="endDate"
                  label="End date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  error={fieldErrors.endDate?.[0]}
                />
              </div>
            </div>
          </div>
        </Card>

        {formError && (
          <div className="mt-5">
            <ErrorState message={formError} />
          </div>
        )}

        <div className="mt-6">
          <Button type="submit" isLoading={submitting}>
            {submitting ? "Saving…" : "Continue"}
          </Button>
        </div>
      </form>
    </WizardShell>
  );
}
