export type WizardStepKey = "basics" | "differentiators" | "dataset" | "buildings" | "review" | "confirm";

export const WIZARD_STEPS: { key: WizardStepKey; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "differentiators", label: "Differentiators" },
  { key: "dataset", label: "Dataset" },
  { key: "buildings", label: "Buildings" },
  { key: "review", label: "Review" },
  { key: "confirm", label: "Confirm" },
];

// Purely presentational — derives which steps already have persisted data,
// from the same fields campaign-service.ts's own resumeCampaignPath()
// checks (differentiators array, campaignDatasets rows, campaignBuildings
// rows). This never gates access; each page's own existing redirect/guard
// logic is what actually controls navigation. Only used to decide the step
// indicator's checkmarks and which steps are safe to link back to.
export function computeCompletedSteps(detail: {
  campaign: { differentiators: unknown };
  datasets: unknown[];
  buildings: unknown[];
}): WizardStepKey[] {
  const completed: WizardStepKey[] = ["basics"];
  if (Array.isArray(detail.campaign.differentiators) && detail.campaign.differentiators.length > 0) {
    completed.push("differentiators");
  }
  if (detail.datasets.length > 0) completed.push("dataset");
  if (detail.buildings.length > 0) completed.push("buildings");
  return completed;
}
