"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser-client";
import { Dropdown } from "@/components/ui/dropdown";

// Sign-out is new UI wiring (calls the existing, already-used Supabase
// browser client's own signOut() — no new backend code) — there was no
// sign-out affordance anywhere in the app before this.
export function UserMenu({ email }: { email: string | null }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Dropdown
      trigger={
        <span className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-surface-raised">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {email ? email.charAt(0).toUpperCase() : "?"}
          </span>
          <span className="hidden max-w-[10rem] truncate sm:inline">{email ?? "Account"}</span>
        </span>
      }
      items={[{ label: "Sign out", onClick: handleSignOut, danger: true }]}
    />
  );
}
