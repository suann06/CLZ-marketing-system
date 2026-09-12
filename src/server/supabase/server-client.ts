import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var "${name}". Copy .env.example to .env.local and fill in your Supabase project values.`,
    );
  }
  return value;
}

// Server-side Supabase client for use in Server Components, Route Handlers,
// and Server Actions. Reads/writes the auth cookie via Next.js's cookies().
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render — the middleware is
            // responsible for refreshing the session in that case.
          }
        },
      },
    },
  );
}
