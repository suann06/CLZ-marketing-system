import { z } from "zod";

// leadId, campaignId, and closedAt are deliberately NOT fields in this
// schema at all — not optional, not stripped, simply absent — so the
// client cannot supply or influence them even if it tries. campaignId is
// always derived from the Lead server-side (sale-service.ts); closedAt is
// always server-generated. See sale-service.ts for both.
//
// .strict() on each branch means sending saleValue alongside status:"lost"
// (or lostReason alongside status:"won") is a validation error, not
// silently ignored — this is what structurally enforces the won/lost
// cross-field business rules, not service-layer branching.
export const saleOutcomeInputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("won"),
    saleValue: z.number().positive(),
  }).strict(),
  z.object({
    status: z.literal("lost"),
    lostReason: z.string().min(1),
  }).strict(),
]);

export type SaleOutcomeInput = z.infer<typeof saleOutcomeInputSchema>;
