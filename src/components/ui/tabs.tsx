"use client";

import { useState, type ReactNode } from "react";

export type TabItem = {
  key: string;
  label: string;
  content: ReactNode;
};

export function Tabs({ tabs, defaultTab }: { tabs: TabItem[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);

  return (
    <div>
      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
              active === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tabs.find((tab) => tab.key === active)?.content}</div>
    </div>
  );
}
