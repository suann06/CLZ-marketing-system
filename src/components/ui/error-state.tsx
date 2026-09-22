import type { ReactNode } from "react";

// `variant="inline"` (default): a simple left accent-stripe + message, no
// fill, no box — for form/action errors ("could not save", "could not
// reach the server"). `variant="page"`: the more visually prominent
// filled treatment, reserved for page-level blocking errors (a route's
// error.tsx boundary) where the error genuinely is the whole page.
export function ErrorState({
  message,
  action,
  variant = "inline",
}: {
  message: string;
  action?: ReactNode;
  variant?: "inline" | "page";
}) {
  if (variant === "page") {
    return (
      <div className="rounded-[14px] border border-error/20 bg-error-bg px-5 py-4 text-sm text-error">
        <p>{message}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    );
  }

  return (
    <div className="border-l-2 border-error py-1 pl-3 text-sm text-foreground">
      <p>{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
