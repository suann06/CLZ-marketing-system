import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/server/supabase/middleware-client";

// Renamed from `middleware` in Next.js 16 — same behavior, new file/export
// name. See node_modules/next/dist/docs/01-app/.../proxy.md.
export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
