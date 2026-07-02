"use server";

import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { db, profiles } from "@/db";
import { sanitizeText } from "@/lib/sanitize";
import { createSupabaseServer } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/schemas/auth";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function toFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: "Регистрацията не бе успешна. Имейлът може вече да е зает." };
  }

  await db
    .insert(profiles)
    .values({ id: data.user.id, fullName: sanitizeText(parsed.data.fullName, 100) })
    .onConflictDoNothing();

  redirect("/dashboard");
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: "Грешен имейл или парола." };

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
