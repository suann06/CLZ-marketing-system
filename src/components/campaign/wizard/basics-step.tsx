"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { campaignBasicsSchema } from "@/server/validation/campaign-schema";

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
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold">New Campaign</h1>
      <p className="mb-6 text-sm text-gray-500">Step 1 of 6 — Campaign Basics</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">
            Campaign Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />
          {fieldErrors.name && <p className="text-sm text-red-600">{fieldErrors.name[0]}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="productPromotion" className="text-sm font-medium">
            Product / Promotion
          </label>
          <input
            id="productPromotion"
            value={productPromotion}
            onChange={(e) => setProductPromotion(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />
          {fieldErrors.productPromotion && (
            <p className="text-sm text-red-600">{fieldErrors.productPromotion[0]}</p>
          )}
        </div>

        <fieldset className="flex flex-col gap-3 rounded border border-gray-200 p-4">
          <legend className="px-1 text-sm font-medium">Official Pricing</legend>

          <div className="flex flex-col gap-1">
            <label htmlFor="amount" className="text-sm">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="currency" className="text-sm">
              Currency
            </label>
            <input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="terms" className="text-sm">
              Terms <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
            />
          </div>

          {fieldErrors.officialPricing && (
            <p className="text-sm text-red-600">{fieldErrors.officialPricing[0]}</p>
          )}
        </fieldset>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="startDate" className="text-sm font-medium">
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
            />
            {fieldErrors.startDate && <p className="text-sm text-red-600">{fieldErrors.startDate[0]}</p>}
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="endDate" className="text-sm font-medium">
              End Date
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
            />
            {fieldErrors.endDate && <p className="text-sm text-red-600">{fieldErrors.endDate[0]}</p>}
          </div>
        </div>

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
