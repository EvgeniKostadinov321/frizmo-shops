"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Icon, Input, Logo } from "@/components/ui";
import { signInWithProvider, type AuthFormState } from "@/actions/auth";

interface AuthFormProps {
  mode: "login" | "register";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  oauthError?: string;
  /** Роля от toggle-а: „buyer" (пазарувам) или „seller" (продавам). По подразбиране продавач. */
  role?: "buyer" | "seller";
  /** Дестинация след вход (напр. върнат в checkout). Прокарва се към Google + имейл входа. */
  next?: string;
}

/** Тихи доказателства до маскота — продавачки (същият език като landing trust лентата). */
const SELLER_PROOFS = [
  "Без комисиона от продажбите",
  "Готов магазин за минути",
  "30 дни безплатно, плащане след 30 дни",
];

/** Купувачки доказателства — фокус върху пазаруването, не върху бизнеса. */
const BUYER_PROOFS = [
  "Всичките ти поръчки на едно място",
  "Запазени адреси за бърза поръчка",
  "Любими продукти, синхронизирани навсякъде",
];

export function AuthForm({ mode, action, oauthError, role, next }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  /* Маскотът „закрива очи", докато полето за парола е на фокус — дискретна
     интеракция, която прави екрана жив без да отвлича. Един state контролира и
     панелната (desktop) и мобилната пчела. */
  const [peeking, setPeeking] = useState(false);
  const isRegister = mode === "register";
  /* Роля от toggle-а. Default „seller" — запазва досегашния (продавачки) екран. */
  const activeRole = role ?? "seller";
  const isBuyer = activeRole === "buyer";
  /* Маскотът зависи от ролята: купувач → пчела с пазарска кошница; продавач →
     маха/наднича (както преди). При фокус на паролата „закрива очи" (bee-peek). */
  const beeSrc = peeking ? "/bee-peek.png" : isBuyer ? "/bee-basket.png" : "/bee-wave.png";
  const proofs = isBuyer ? BUYER_PROOFS : SELLER_PROOFS;
  /* Заглавие + подзаглавие на десния панел — различни по роля. */
  const panelTitle = isBuyer
    ? "Пазарувай спокойно, всичко е подредено."
    : "Твоят магазин, готов преди кафето.";
  const panelSubtitle = isBuyer
    ? "Следи поръчките си, пази адреси за бърза поръчка и събирай любими продукти — от всеки магазин в Frizmo."
    : "Собствен онлайн магазин, направен за българския търговец — без хаос, без комисиони, без технически главоболия.";
  const roleHref = (r: "buyer" | "seller") =>
    `/auth/${isRegister ? "register" : "login"}?role=${r}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  /* Различен глас по роля (kicker + подзаглавие). */
  const kicker = isBuyer
    ? isRegister
      ? "Нов купувач"
      : "Добре дошъл"
    : isRegister
      ? "Нов магазин"
      : "Добре дошъл";
  const title = isRegister ? "Създай профил" : "Влез в профила си";
  const subtitle = isBuyer
    ? "Влез, за да следиш поръчките си, адресите и любимите."
    : isRegister
      ? "Няколко полета и си готов да продаваш. Без ангажимент, без договори."
      : "Радваме се да те видим отново.";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Ляво: формата. PWA — падингите уважават safe areas (notch/home indicator). */}
      <main
        className="relative flex flex-col items-center justify-center px-6 py-8 sm:px-10"
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
          {/* Назад към landing — винаги наличен изход (напр. след logout, за да не
              се налага ръчно чистене на URL-а). */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
          >
            <Icon name="chevron-down" size={16} className="rotate-90" />
            Назад към сайта
          </Link>

          {/* Лого — центрирано на мобилно, ляво на desktop */}
          <div className="flex justify-center lg:justify-start">
            <Logo href="/" />
          </div>

          {/* Мобилен hero блок: едра центрирана пчела + заглавие (панелът поема
              това на desktop). Центрирането разтоварва „натрупания" вид. */}
          <div className="flex flex-col items-center gap-4 text-center lg:hidden">
            <Image
              src={beeSrc}
              alt=""
              aria-hidden
              width={320}
              height={320}
              priority
              className="h-40 w-40 select-none drop-shadow-[0_12px_28px_rgba(28,36,32,0.18)] transition-transform duration-300"
            />
            <div className="flex flex-col items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
                {kicker}
              </p>
              <h1 className="text-balance font-display text-4xl font-extrabold tracking-tight text-ink-900">
                {title}
              </h1>
              <p className="max-w-xs text-pretty text-ink-500">{subtitle}</p>
            </div>
          </div>

          {/* Desktop заглавен блок (ляво-подравнен; пчелата е в панела вдясно) */}
          <div className="hidden flex-col gap-2 lg:flex">
            <p className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
              <span className="shrink-0">{kicker}</span>
              <span aria-hidden className="h-px flex-1 bg-surface-200" />
            </p>
            <h1 className="text-balance font-display text-4xl font-extrabold tracking-tight text-ink-900">
              {title}
            </h1>
            <p className="text-pretty text-ink-500">{subtitle}</p>
          </div>

          {/* Toggle роля — „Пазарувам" / „Продавам". Линкове (не state) → сменят ?role
              в URL-а: работи без JS, активният е подчертан. Сменя copy + къде отива входът. */}
          <div className="flex rounded-control border border-surface-200 bg-surface-0 p-1 text-sm font-medium">
            <Link
              href={roleHref("buyer")}
              className={`flex-1 rounded-[calc(var(--radius-control)-2px)] py-2 text-center transition-colors ${
                isBuyer ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              Пазарувам
            </Link>
            <Link
              href={roleHref("seller")}
              className={`flex-1 rounded-[calc(var(--radius-control)-2px)] py-2 text-center transition-colors ${
                !isBuyer ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              Продавам
            </Link>
          </div>

          {/* Social login — над имейл формата, с „или" divider. Отделен контрол от
              useActionState формата: собствен form с action-а. Google „G" лого inline
              (multicolor, не се вписва в монохромния Icon set). Купувач → връща се в
              профила (или подадения next); продавач → dashboard (default в action-а). */}
          {oauthError && <p className="text-sm text-danger-600">{oauthError}</p>}
          <form action={signInWithProvider.bind(null, isBuyer ? (next ?? "/account") : next)}>
            <Button type="submit" variant="secondary" size="lg" className="w-full gap-3">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34Z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
                />
              </svg>
              Продължи с Google
            </Button>
          </form>

          {/* „или" divider */}
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-px flex-1 bg-surface-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-ink-500">
              или
            </span>
            <span aria-hidden className="h-px flex-1 bg-surface-200" />
          </div>

          <form action={formAction} className="flex flex-col gap-4" noValidate>
            {/* Роля + next пътуват със submit-а: signUp пише preferredRole, signIn/signUp
                пренасочват по роля. */}
            <input type="hidden" name="role" value={activeRole} />
            {next && <input type="hidden" name="next" value={next} />}
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
                  href={`/auth/login?role=${activeRole}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
                >
                  Влез
                </Link>
              </>
            ) : (
              <>
                Нямаш профил?{" "}
                <Link
                  className="font-medium text-brand-600 hover:underline"
                  href={`/auth/register?role=${activeRole}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
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
              {panelTitle}
            </h2>
            <p className="text-pretty text-brand-surface-muted">{panelSubtitle}</p>
          </div>
          <ul className="flex flex-col gap-3 text-left">
            {proofs.map((proof) => (
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
