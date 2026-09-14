import { z } from "zod";

// campaignId is the sole authoritative campaign attribution for a Lead —
// mirrors acquisition-schema.ts's rule. It is required, never inferred
// from phone/UTM/heuristics: a payload without it is rejected by the route
// before any Lead is created (see /api/whatsapp/webhook/route.ts).
export const whatsAppWebhookSchema = z.object({
  campaignId: z.string().uuid(),
  phone: z.string().min(1),
  message: z.string().min(1),
  externalMessageId: z.string().min(1).optional(),
  externalThreadId: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  acquisitionEventId: z.string().uuid().optional(),
});

export type WhatsAppWebhookInput = z.infer<typeof whatsAppWebhookSchema>;
