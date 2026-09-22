// agentId only ever holds a Supabase auth.users UUID — there is no Agent
// model and no join path to a human-readable name anywhere in this
// codebase (see Lead.agentId's own schema comment). This never guesses or
// fabricates a name; it shows the literal id (truncated for scannability)
// so the limitation stays visible rather than hidden behind a fake label.
export function agentLabel(agentId: string | null): string {
  if (!agentId) return "Unassigned";
  return `Agent ${agentId.slice(0, 8)}…`;
}
