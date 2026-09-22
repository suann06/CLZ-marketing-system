import { redirect } from "next/navigation";

// Applications are not a separate entity with its own detail view — this
// redirects to the existing Lead detail route rather than building a
// duplicated Application detail UI (per the approved Phase 4D scope).
export default async function ApplicationDetailRedirect({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  redirect(`/leads/${leadId}`);
}
