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
      className={`anim-fade fixed inset-0 z-50 flex bg-black/60 ${side === "right" ? "justify-end" : "justify-start"}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`anim-slide-in-right shadow-elevated h-full w-full max-w-xs overflow-y-auto bg-surface p-6 ${
          side === "right" ? "rounded-l-[20px]" : "rounded-r-[20px]"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {title && <p className="mb-4 text-base font-semibold text-foreground">{title}</p>}
        {children}
      </div>
    </div>
  );
}
