import type { ReactNode } from "react";

// Available for pages to adopt going forward — existing pages keep their
// own inline container divs for now (restyling existing page content is
// Phase 4B, not 4A); this exists so nothing new has to invent its own
// max-width/padding convention.
export function PageContainer({
  children,
  className = "",
  maxWidth = "max-w-4xl",
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}) {
  return <div className={`mx-auto w-full ${maxWidth} px-4 py-10 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}
