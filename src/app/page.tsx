import { redirect } from "next/navigation";

// Was the untouched create-next-app starter page. The (staff) layout
// handles the actual auth check/redirect to /login when landing on
// /dashboard unauthenticated — this route only decides where "/" goes.
export default function RootPage() {
  redirect("/dashboard");
}
