import { redirect } from "next/navigation";
import { db, profiles } from "@/db";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Връща auth потребителя или пренасочва към login. За Server Components/Actions. */
export async function requireUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  return user;
}

/** Идемпотентно гарантира ред в profiles (предпазна мрежа при прекъснат signup). */
export async function ensureProfile(userId: string) {
  await db.insert(profiles).values({ id: userId }).onConflictDoNothing();
}
