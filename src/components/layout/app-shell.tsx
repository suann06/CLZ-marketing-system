"use client";

import { useState, type ReactNode } from "react";
import { Sidebar, SidebarNav } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Drawer } from "@/components/ui/drawer";

// The persistent shell every (staff) page now renders inside — see
// (staff)/layout.tsx. Sidebar is hidden below md and replaced by a Drawer
// triggered from Topbar's hamburger button (responsive sidebar behavior).
export function AppShell({ children, userEmail }: { children: ReactNode; userEmail: string | null }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} userEmail={userEmail} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Menu">
        <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>
    </div>
  );
}
