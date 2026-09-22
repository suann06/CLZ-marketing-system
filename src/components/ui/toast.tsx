"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "info";
type ToastItem = { id: number; message: string; variant: ToastVariant };

const ToastContext = createContext<{ showToast: (message: string, variant?: ToastVariant) => void } | null>(null);

let nextToastId = 1;

// Mounted once, at the root layout, so any page/component in the app can
// call useToast() — not scoped to (staff) only, since /login could
// reasonably want it too (e.g. a future "check your email" toast).
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`anim-slide-in-right shadow-elevated pointer-events-auto rounded-[14px] border px-4 py-2.5 text-sm ${
              t.variant === "success"
                ? "border-success/20 bg-success-bg text-success"
                : t.variant === "error"
                  ? "border-error/20 bg-error-bg text-error"
                  : "border-border bg-surface text-foreground"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast() must be used within <ToastProvider>.");
  }
  return ctx;
}
