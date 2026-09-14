import { z } from "zod";

// Validates an AI provider's classification output before
// lead-classification-service.ts ever applies it to Lead.status — same
// role ai-conversation-schema.ts plays for conversation output.
//
// classification is a closed enum of exactly hot/warm/cold. This
// structurally rejects "qualified", "interested", "very_hot", "new", or any
// other value a provider might try to return — there is no such key in
// this schema, so an unsupported value fails validation rather than being
// coerced or silently accepted. "new" is deliberately not a valid AI
// classification output — it is the Lead's pre-classification default,
// decided by lead-classification-service.ts, never proposed by the AI.
export const leadClassificationOutputSchema = z
  .object({
    classification: z.enum(["hot", "warm", "cold"]),
    reason: z.string().min(1),
  })
  .strict();

export type LeadClassificationOutput = z.infer<typeof leadClassificationOutputSchema>;
