import { z } from "zod";

// Validates the AI's advisory explanation of ALREADY-COMPUTED Stage 11
// metrics before feedback-service.ts ever exposes it. Two layers of
// safety:
//
// 1. Structural — .strict() means the AI cannot smuggle in any field
//    beyond `summary`/`highlights` (e.g. no numeric field it could use to
//    quietly override a real metric).
// 2. Wording — a .refine() rejects any causal/guarantee language
//    ("caused", "guarantee(s/d)", "predicted to succeed", "best because
//    of"), which the business rule requires be treated as unsafe advisory
//    output. This is a defensive backstop on top of the stub's own
//    deterministic wording (see stub-ai-provider.ts's explainFeedback()) —
//    it exists so that if a future real provider ever generated such
//    language, it would be rejected here rather than silently exposed.
const FORBIDDEN_CAUSAL_LANGUAGE =
  /\b(caused|causes|guarantee(?:s|d)?|predicted to succeed|best because of)\b/i;

const advisoryText = z
  .string()
  .min(1)
  .refine((text) => !FORBIDDEN_CAUSAL_LANGUAGE.test(text), {
    message: "Explanation text must not contain causal or guarantee language.",
  });

export const aiFeedbackExplanationOutputSchema = z
  .object({
    summary: advisoryText,
    highlights: z.array(advisoryText).max(10),
  })
  .strict();

export type AiFeedbackExplanationOutput = z.infer<typeof aiFeedbackExplanationOutputSchema>;
