import { z } from "zod";

// Mirrors the existing ApplicationStatus enum exactly — no "qualified"
// value exists here or anywhere else; qualified-lead is a computed
// business outcome (see application-service.ts's isQualifiedLead()), not
// a stored status.
export const applicationStatusInputSchema = z.object({
  applicationStatus: z.enum(["not_started", "in_progress", "submitted"]),
});

export type ApplicationStatusInput = z.infer<typeof applicationStatusInputSchema>;
