import type { ReactNode } from "react";
import Link from "next/link";
import { WIZARD_STEPS, type WizardStepKey } from "./wizard-steps";

// Never used to gate access — see wizard-steps.ts. Only decides which
// completed steps are safe to link back to from the indicator (basics has
// no edit route; the current step and any incomplete/future step are never
// links, so users can't skip ahead through the indicator itself).
function hrefFor(key: WizardStepKey, campaignId: string | null, isCurrent: boolean, isCompleted: boolean): string | null {
  if (isCurrent || !isCompleted || !campaignId) return null;
  switch (key) {
    case "differentiators":
      return `/campaigns/${campaignId}/differentiators`;
    case "dataset":
      return `/campaigns/${campaignId}/datasets`;
    case "buildings":
      return `/campaigns/${campaignId}/buildings`;
    case "review":
      return `/campaigns/${campaignId}/review`;
    default:
      return null;
  }
}

// Shared shell for every step of the campaign creation wizard (Phase 4C).
// Presentational only — no fetches, no mutations. Each step component keeps
// its own state/validation/submit logic untouched and renders as `children`.
export function WizardShell({
  campaignId,
  title,
  currentStep,
  completedSteps,
  children,
}: {
  campaignId: string | null;
  title: string;
  currentStep: WizardStepKey;
  completedSteps: WizardStepKey[];
  children: ReactNode;
}) {
  const completed = new Set(completedSteps);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="mb-1.5 text-sm text-muted">New campaign</p>
      <h1 className="mb-8 text-[1.75rem] font-semibold tracking-tight text-foreground">{title}</h1>

      {/* Chip-style stepper — visually inspired by the approved Stitch
          wizard reference, but still exactly WIZARD_STEPS' 5 real steps
          (basics/differentiators/dataset/buildings/review) with the same
          hrefFor()/completed logic as before; nothing here changes what
          step comes next or how completion is determined. */}
      <ol
        className="mb-10 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-2.5"
        aria-label="Campaign creation steps"
      >
        {WIZARD_STEPS.map((step, index) => {
          const isCurrent = step.key === currentStep;
          const isCompleted = completed.has(step.key) && !isCurrent;
          const href = hrefFor(step.key, campaignId, isCurrent, isCompleted);

          const chipClasses = `flex items-center gap-2.5 rounded-xl border p-2 transition-colors duration-150 ${
            isCurrent
              ? "border-primary/30 bg-accent-subtle"
              : isCompleted
                ? "border-border bg-surface-sunken hover:bg-surface-raised"
                : "border-border bg-surface-sunken opacity-70"
          }`;

          const badge = (
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-150 ${
                isCurrent
                  ? "border-primary bg-primary text-primary-foreground"
                  : isCompleted
                    ? "border-primary/40 bg-transparent text-primary"
                    : "border-border text-muted"
              }`}
              aria-hidden
            >
              {isCompleted ? "✓" : index + 1}
            </span>
          );

          const label = (
            <span className="flex min-w-0 flex-col">
              <span className="text-[10px] font-semibold tracking-wider text-muted uppercase">Step {index + 1}</span>
              <span
                className={`truncate text-xs font-medium ${
                  isCurrent ? "text-foreground" : isCompleted ? "text-secondary" : "text-muted"
                }`}
              >
                {step.label}
              </span>
            </span>
          );

          const content = href ? (
            <Link href={href} className={chipClasses}>
              {badge}
              {label}
            </Link>
          ) : (
            <span className={chipClasses} aria-current={isCurrent ? "step" : undefined}>
              {badge}
              {label}
            </span>
          );

          return (
            <li key={step.key} className="min-w-0">
              {content}
            </li>
          );
        })}
      </ol>

      {children}
    </div>
  );
}
