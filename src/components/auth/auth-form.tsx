"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Input, Logo } from "@/components/ui";
import type { AuthFormState } from "@/actions/auth";

interface AuthFormProps {
  mode: "login" | "register";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}

/** Тихи доказателства до маскота — същият език като landing trust лентата. */
const PROOFS = [
  "Без комисиона от продажбите",
  "Готов магазин за минути",
  "30 дни безплатно, без карта",
];

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  /* Маскотът „закрива очи", докато полето за парола е на фокус — дискретна
     интеракция, която прави екрана жив без да отвлича. Един state контролира и
     панелната (desktop) и мобилната пчела. */
  const [peeking, setPeeking] = useState(false);
  const isRegister = mode === "register";
  const beeSrc = peeking ? "/bee-peek.png" : "/bee-wave.png";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Ляво: формата */}
      <main className="relative flex flex-col items-center justify-center px-6 py-10 sm:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-hero-glow)]"
        />
        <div className="relative flex w-full max-w-md flex-col gap-6">
          <Logo href="/" />

          {/* Маскот — видим само на мобилно (панелът вдясно го поема на desktop) */}
          <Image
            src={beeSrc}
            alt=""
            aria-hidden
            width={200}
            height={200}
            priority
            className="-mb-2 h-24 w-24 select-none lg:hidden"
          />

          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
              <span className="shrink-0">
                {isRegister ? "Нов магазин" : "Добре дошъл"}
              </span>
              <span aria-hidden className="h-px flex-1 bg-surface-200" />
            </p>
            <h1 className="text-balance font-display text-4xl font-extrabold tracking-tight text-ink-900">
              {isRegister ? "Създай профил" : "Влез в профила си"}
            </h1>
            <p className="text-pretty text-ink-500">
              {isRegister
                ? "Няколко полета и си готов да продаваш. Без карта, без договори."
                : "Радваме се да те видим отново."}
            </p>
          </div>

          <form action={formAction} className="flex flex-col gap-4" noValidate>
            {isRegister && (
              <Input
                label="Име и фамилия"
                name="fullName"
                autoComplete="name"
                error={state.fieldErrors?.fullName}
              />
            )}
            <Input
              label="Имейл"
              name="email"
              type="email"
              autoComplete="email"
              error={state.fieldErrors?.email}
            />
            <Input
              label="Парола"
              name="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              error={state.fieldErrors?.password}
              onFocus={() => setPeeking(true)}
              onBlur={() => setPeeking(false)}
            />
            {state.error && <p className="text-sm text-danger-600">{state.error}</p>}
            <Button type="submit" size="lg" loading={pending} className="mt-2">
              {isRegister ? "Регистрирай се" : "Влез"}
            </Button>
          </form>

          <p className="text-sm text-ink-500">
            {isRegister ? (
              <>
                Имаш профил?{" "}
                <Link
                  className="font-medium text-brand-600 hover:underline"
                  href="/auth/login"
                >
                  Влез
                </Link>
              </>
            ) : (
              <>
                Нямаш профил?{" "}
                <Link
                  className="font-medium text-brand-600 hover:underline"
                  href="/auth/register"
                >
                  Регистрирай се
                </Link>
              </>
            )}
          </p>
        </div>
      </main>

      {/* Дясно: брандов панел с реагиращия маскот — само desktop */}
      <aside className="relative hidden overflow-hidden bg-brand-surface lg:flex lg:flex-col lg:justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-cta)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.4] bg-[image:var(--texture-noise)]"
        />
        <div className="relative flex flex-col items-center gap-8 px-12 text-center">
          <Image
            src={beeSrc}
            alt="Маскотът на Frizmo Shops"
            width={320}
            height={320}
            priority
            className="h-auto w-[220px] select-none drop-shadow-[0_18px_40px_rgba(0,0,0,0.35)] xl:w-[280px]"
          />
          <div className="flex flex-col gap-4">
            <h2 className="text-balance font-display text-3xl font-extrabold tracking-tight text-brand-surface-ink xl:text-4xl">
              Твоят магазин, готов преди кафето.
            </h2>
            <p className="text-pretty text-brand-surface-muted">
              Собствен онлайн магазин, направен за българския търговец — без хаос,
              без комисиони, без технически главоболия.
            </p>
          </div>
          <ul className="flex flex-col gap-3 text-left">
            {PROOFS.map((proof) => (
              <li
                key={proof}
                className="flex items-center gap-3 text-brand-surface-ink"
              >
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-ember-500/20 text-ember-500"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span className="text-sm">{proof}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
