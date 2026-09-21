import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireHumanActor, UnauthenticatedError } from "@/lib/actor";
import { createSupabaseServerClient } from "@/server/supabase/server-client";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

// The single auth check for every staff page — previously each of the 14
// pages under (staff)/ repeated this same try/catch independently.
// Behavior is unchanged (UnauthenticatedError -> redirect to /login); it
// now runs once per request at the layout level instead of once per page.
export default async function StaffLayout({ children }: { children: ReactNode }) {
  try {
    await requireHumanActor();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/login");
    }
    throw err;
  }

  // Display-only: requireHumanActor() itself only returns {type, id}, not
  // an email, and lib/actor.ts is deliberately left untouched (no business
  // logic change) — this is a second, separate read of the same already-
  // established session, purely for the UserMenu label.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <AppShell userEmail={user?.email ?? null}>{children}</AppShell>;
}
