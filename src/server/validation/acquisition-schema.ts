import { z } from "zod";

// Attribution values are kept exactly as received — no trimming/normalizing
// beyond requiring non-empty strings when present. campaignId is the sole
// authoritative campaign attribution; these fields are never merged into or
// used to infer it.
export const acquisitionClickSchema = z.object({
  campaignId: z.string().uuid(),
  source: z.string().min(1).optional(),
  medium: z.string().min(1).optional(),
  campaign: z.string().min(1).optional(),
  ref: z.string().min(1).optional(),
});

export type AcquisitionClickInput = z.infer<typeof acquisitionClickSchema>;
