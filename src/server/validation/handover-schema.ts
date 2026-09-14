import { z } from "zod";

// agentId is optional — when omitted, handover-service.ts assigns the
// acting human actor's own id (self-assigning the hot Lead). No role
// system exists yet (see Phase 1), so any authenticated staff user may
// hand a Lead over to themselves or to another agent's id.
export const handoverInputSchema = z.object({
  agentId: z.string().uuid().optional(),
});

export type HandoverInput = z.infer<typeof handoverInputSchema>;
