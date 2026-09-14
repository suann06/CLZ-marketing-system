import { z } from "zod";

// Validates Claude's structured content output before it is ever persisted.
// No partially-valid content reaches the database — see
// content-generation-service.ts's callAiWithRetry().
//
// `notes` is internal reviewer-facing rationale only — never customer-facing
// copy. UI/consumers must keep it visually and structurally separate from
// headline/bodyText/cta/hashtags.
export const contentVariantSchema = z.object({
  variantLabel: z.string().min(1),
  headline: z.string().min(1),
  bodyText: z.string().min(1),
  cta: z.string().min(1),
  hashtags: z.array(z.string().min(1)).optional(),
  notes: z.string().optional(),
});

// At least one variant per platform is required; no maximum is enforced
// here — the prompt strongly instructs 2-3, but that's guidance, not a
// schema-level cap.
export const contentSetOutputSchema = z.object({
  facebook: z.array(contentVariantSchema).min(1),
  instagram: z.array(contentVariantSchema).min(1),
  tiktok: z.array(contentVariantSchema).min(1),
  whatsapp: z.array(contentVariantSchema).min(1),
});

export type ContentVariant = z.infer<typeof contentVariantSchema>;
export type ContentSetOutput = z.infer<typeof contentSetOutputSchema>;
