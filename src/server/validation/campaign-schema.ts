import { z } from "zod";

// Official facts only — never merged with differentiators. See
// docs/architecture.md for why this separation matters for Phase 2.
export const officialPricingSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().min(1).default("MYR"),
  terms: z.string().optional(),
});

export const campaignBasicsSchema = z
  .object({
    name: z.string().min(1, "Campaign name is required"),
    productPromotion: z.string().min(1, "Product/promotion is required"),
    officialPricing: officialPricingSchema,
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export type CampaignBasicsInput = z.infer<typeof campaignBasicsSchema>;

// CLZ-specific marketing angles — kept structurally separate from
// officialPricing, never blended into it.
export const differentiatorsSchema = z.object({
  differentiators: z.array(z.string().min(1)).default([]),
});

export type DifferentiatorsInput = z.infer<typeof differentiatorsSchema>;

export const datasetSelectionSchema = z.object({
  datasetIds: z.array(z.string().uuid()).min(1, "Select at least one dataset"),
});

export type DatasetSelectionInput = z.infer<typeof datasetSelectionSchema>;

export const buildingSelectionSchema = z.object({
  buildingIds: z.array(z.string().uuid()).min(1, "Select at least one building"),
});

export type BuildingSelectionInput = z.infer<typeof buildingSelectionSchema>;
