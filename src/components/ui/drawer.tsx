"use client";

import type { ReactNode } from "react";

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "right",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: "left" | "right";
}) {
  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/40 ${side === "right" ? "justify-end" : "justify-start"}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="h-full w-full max-w-xs overflow-y-auto border-border bg-surface p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        {title && <p className="mb-4 text-base font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
