import { z } from "zod";

// Validates an AI provider's conversation output before conversation-service
// ever persists it — same role acquisitionClickSchema/whatsAppWebhookSchema
// play at their own boundaries.
//
// Both objects are `.strict()`: no extra key survives validation. This is
// what structurally guarantees the AI output can never carry a
// hot/warm/cold (or any other) classification field — there is no key in
// this schema for one, and a provider that tried to add one would fail
// validation rather than have the extra field silently ignored.
const customerInfoSchema = z
  .object({
    name: z.string().min(1).nullable().optional(),
    location: z.string().min(1).nullable().optional(),
    currentProvider: z.string().min(1).nullable().optional(),
    interest: z.string().min(1).nullable().optional(),
  })
  .strict();

export const aiConversationOutputSchema = z
  .object({
    response: z.string().min(1),
    customerInfo: customerInfoSchema,
  })
  .strict();

export type AiConversationOutput = z.infer<typeof aiConversationOutputSchema>;
