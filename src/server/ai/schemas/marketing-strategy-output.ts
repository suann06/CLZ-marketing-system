import { z } from "zod";

// Validates Claude's structured output before it is ever persisted. No
// partially-valid content reaches the database — see
// marketing-strategy-service.ts's callAiWithRetry().
export const marketingStrategyOutputSchema = z.object({
  targetAudience: z.object({
    description: z.string().min(1),
    segments: z.array(z.string().min(1)).min(1),
  }),
  customerNeeds: z.array(z.string().min(1)).min(1),
  positioning: z.string().min(1),
  marketingAngles: z.array(z.string().min(1)).min(1),
  messagingPillars: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .min(1),
  platformDirection: z
    .array(
      z.object({
        platform: z.enum(["facebook", "instagram", "tiktok", "whatsapp"]),
        direction: z.string().min(1),
      }),
    )
    .min(1),
  cta: z.string().min(1),
});

export type MarketingStrategyOutput = z.infer<typeof marketingStrategyOutputSchema>;
