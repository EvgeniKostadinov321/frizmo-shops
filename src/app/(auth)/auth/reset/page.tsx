import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { Button } from "@/components/ui";
import { createSupabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Нова парола — Frizmo Shops" };

export default async function ResetPasswordPage() {
  /* Recovery линкът вече е логнал потребителя през callback-а → трябва да има сесия.
     Без сесия (директен достъп / изтекъл линк) → покажи мек изход, не празна форма. */
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
          Линкът е изтекъл
        </h1>
        <p className="max-w-sm text-pretty text-ink-500">
          Линкът за възстановяване е невалиден или изтекъл. Поискай нов от страницата
          „Забравена парола“.
        </p>
        <Link href="/auth/forgot">
          <Button size="lg">Поискай нов линк</Button>
        </Link>
      </main>
    );
  }

  return <ResetPasswordForm />;
}
