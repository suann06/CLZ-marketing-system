import type { SVGProps } from "react";

// Small local icon set for the sidebar nav — matches the outlined-icon
// look of the approved Stitch design (which uses Google's Material Symbols
// webfont) without pulling in an icon font or an icon-library dependency
// this project doesn't otherwise have. One 20x20 stroke icon per nav
// destination that already exists in NAV_GROUPS (sidebar.tsx) — no icons
// for routes that don't exist.
type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function CampaignIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11v2a2 2 0 0 0 2 2h1l2 5h2l-1.5-5H10l8 4V6l-8 4H5a2 2 0 0 0-2 2Z" />
      <path d="M18 9v6" />
    </svg>
  );
}

export function LeadsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20c.7-3.2 3-5 5.5-5s4.8 1.8 5.5 5" />
      <circle cx="17" cy="8.5" r="2.5" />
      <path d="M15.5 12.5c2 .2 3.6 1.8 4 4.5" />
    </svg>
  );
}

export function ApplicationsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14 3.5V8h4.5" />
      <path d="m9.25 14 1.75 1.75L15 12" />
    </svg>
  );
}

export function SalesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M14.75 9.75c0-1.1-1.23-2-2.75-2s-2.75.9-2.75 2 1.23 1.7 2.75 2 2.75.9 2.75 2-1.23 2-2.75 2-2.75-.9-2.75-2" />
    </svg>
  );
}

export function PerformanceIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 19.5h17" />
      <path d="M4.5 16 9 10.5l3.5 3L20 8" />
      <path d="M15.5 8h4.5v4.5" />
    </svg>
  );
}

export function FeedbackIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5h16v10.5a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H5.5A1.5 1.5 0 0 1 4 16V5.5Z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </svg>
  );
}

export const NAV_ICON_BY_HREF: Record<string, (props: IconProps) => React.JSX.Element> = {
  "/dashboard": DashboardIcon,
  "/campaigns": CampaignIcon,
  "/leads": LeadsIcon,
  "/applications": ApplicationsIcon,
  "/sales": SalesIcon,
  "/performance": PerformanceIcon,
  "/feedback": FeedbackIcon,
};
