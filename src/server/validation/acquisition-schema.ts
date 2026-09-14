import { z } from "zod";

// Attribution values are kept exactly as received — no trimming/normalizing
// beyond requiring non-empty strings when present. campaignId is the sole
// authoritative campaign attribution; these fields are never merged into or
// used to infer it.
// datasetId/launchId are optional dataset/creative attribution (Stage 10)
// — the click's tracking link may carry them when it's dataset- or
// creative-specific. acquisition-service.ts validates that a supplied id
// genuinely belongs to this campaign; it is never inferred or guessed
// here or anywhere else.
export const acquisitionClickSchema = z.object({
  campaignId: z.string().uuid(),
  source: z.string().min(1).optional(),
  medium: z.string().min(1).optional(),
  campaign: z.string().min(1).optional(),
  ref: z.string().min(1).optional(),
  datasetId: z.string().uuid().optional(),
  launchId: z.string().uuid().optional(),
});

export type AcquisitionClickInput = z.infer<typeof acquisitionClickSchema>;

// Query-string variant for the deterministic launch-tracking-link endpoint
// (see /api/acquisition/track/[launchId]) — campaignId is NOT a field here
// at all: it is derived server-side from the launchId path segment, never
// accepted from the caller. datasetId stays optional (a campaign may span
// multiple datasets via one shared link) but, when present, is validated
// against the launch's own campaign — see acquisition-service.ts.
export const acquisitionTrackQuerySchema = z.object({
  datasetId: z.string().uuid().optional(),
  source: z.string().min(1).optional(),
  medium: z.string().min(1).optional(),
  campaign: z.string().min(1).optional(),
  ref: z.string().min(1).optional(),
});

export type AcquisitionTrackQueryInput = z.infer<typeof acquisitionTrackQuerySchema>;
