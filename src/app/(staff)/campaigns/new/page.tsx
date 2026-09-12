import { redirect } from "next/navigation";
import { requireHumanActor, UnauthenticatedError } from "@/lib/actor";
import { BasicsStep } from "@/components/campaign/wizard/basics-step";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  try {
    await requireHumanActor();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/login");
    }
    throw err;
  }

  return <BasicsStep />;
}
