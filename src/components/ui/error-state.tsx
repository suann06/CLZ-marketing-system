import type { ReactNode } from "react";

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="rounded border border-red-200 bg-error-bg px-4 py-3 text-sm text-error">
      <p>{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
