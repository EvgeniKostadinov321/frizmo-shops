"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { Button, Icon, Input, Logo } from "@/components/ui";
import {
  requestPasswordReset,
  updatePassword,
  type AuthFormState,
} from "@/actions/auth";

/** Обвивка в стила на AuthForm (ляв панел) — лого + kicker + заглавие + съдържание. */
function AuthShell({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center px-6 py-8 sm:px-10"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-hero-glow)]"
      />
      <div className="relative flex w-full max-w-md flex-col gap-7">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
        >
          <Icon name="chevron-down" size={16} className="rotate-90" />
          Назад към входа
        </Link>
        <div className="flex justify-center lg:justify-start">
          <Logo href="/" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
            <span className="shrink-0">{kicker}</span>
            <span aria-hidden className="h-px flex-1 bg-surface-200" />
          </p>
          <h1 className="text-balance font-display text-4xl font-extrabold tracking-tight text-ink-900">
            {title}
          </h1>
          <p className="text-pretty text-ink-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

/** Стъпка 1 — искане на линк за възстановяване (въвеждане на имейл). */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, {} as AuthFormState);

  if (state.resent) {
    return (
      <AuthShell
        kicker="Провери имейла"
        title="Изпратихме ти линк"
        subtitle="Ако този имейл има профил, ще получиш линк за нова парола."
      >
        <div className="flex flex-col items-center gap-6 text-center">
          <Image
            src="/bee-wave.png"
            alt=""
            aria-hidden
            width={320}
            height={320}
            priority
            className="h-32 w-32 select-none drop-shadow-[0_12px_28px_rgba(28,36,32,0.18)]"
          />
          <p className="text-pretty text-ink-500">
            Отвори имейла{state.email ? ` на ${state.email}` : ""} и кликни линка, за да
            зададеш нова парола. Не виждаш имейла? Провери папка „Спам“.
          </p>
          <Link href="/auth/login" className="text-sm font-medium text-brand-600 hover:underline">
            Обратно към входа
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      kicker="Възстановяване"
      title="Забравена парола"
      subtitle="Въведи имейла си и ще ти изпратим линк за нова парола."
    >
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <Input
          label="Имейл"
          name="email"
          type="email"
          autoComplete="email"
          error={state.fieldErrors?.email}
        />
        {state.error && <p className="text-sm text-danger-600">{state.error}</p>}
        <Button type="submit" size="lg" loading={pending} className="mt-2">
          Изпрати линк
        </Button>
      </form>
      <p className="text-sm text-ink-500">
        Спомни си паролата?{" "}
        <Link className="font-medium text-brand-600 hover:underline" href="/auth/login">
          Влез
        </Link>
      </p>
    </AuthShell>
  );
}

/** Стъпка 2 — задаване на нова парола (recovery сесията вече е активна). */
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, {} as AuthFormState);

  return (
    <AuthShell
      kicker="Нова парола"
      title="Задай нова парола"
      subtitle="Избери нова парола за профила си. Ще влезеш автоматично след това."
    >
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <Input
          label="Нова парола"
          name="password"
          type="password"
          autoComplete="new-password"
          error={state.fieldErrors?.password}
        />
        {state.error && <p className="text-sm text-danger-600">{state.error}</p>}
        <Button type="submit" size="lg" loading={pending} className="mt-2">
          Запази паролата
        </Button>
      </form>
    </AuthShell>
  );
}
