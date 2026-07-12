"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { previewShopSlugAction, type ShopFormState } from "@/actions/shop";
import { AddressAutocomplete } from "./address-autocomplete";
import { WorkingHoursEditor } from "./working-hours-editor";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { defaultWorkingDays, type WorkingDay } from "@/lib/working-hours";
import { MODE_META, type ComplexityMode } from "@/lib/complexity";
import { BUSINESS_CATEGORIES } from "@/schemas/shop";

interface ShopWizardProps {
  action: (prev: ShopFormState, formData: FormData) => Promise<ShopFormState>;
}

const categoryOptions = BUSINESS_CATEGORIES.map((c) => ({ value: c, label: c }));

/** Стъпките на wizard-а — заглавие за индикатора + дали е задължителна. */
const STEPS = [
  { label: "Основно", required: true },
  { label: "Контакти", required: false },
  { label: "Работно време", required: false },
  { label: "Сложност", required: false },
] as const;

type StepIndex = 0 | 1 | 2 | 3;

/**
 * Многостъпков wizard за създаване на магазин. Всички полета живеят в един
 * `<form>` (неактивните стъпки са `hidden`, не unmount-нати) → финалният submit
 * праща пълния FormData към `createShop`. Само стъпка 1 (име + категория) е
 * задължителна; 2 и 3 могат да се прескочат. Работи еднакво на desktop и мобилно
 * (за разлика от two-pane), защото всяка стъпка показва малко полета.
 */
export function ShopWizard({ action }: ShopWizardProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [step, setStep] = useState<StepIndex>(0);

  /* Контролирани, защото адресът попълва града автоматично. */
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [days, setDays] = useState<WorkingDay[]>(defaultWorkingDays());

  /* Клиентска валидация на стъпка 1 преди „Напред". */
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);

  /* Live preview на публичния адрес — на blur на полето „Име". */
  const [slug, setSlug] = useState<{ slug: string; taken: boolean } | null>(null);
  const [slugLoading, setSlugLoading] = useState(false);

  /* Ф2: режим на сложност (стъпка 4). Default „Малък бизнес". */
  const [complexityMode, setComplexityMode] = useState<ComplexityMode>("business");

  async function checkSlug() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setSlug(null);
      return;
    }
    setSlugLoading(true);
    try {
      setSlug(await previewShopSlugAction(trimmed));
    } catch {
      setSlug(null);
    } finally {
      setSlugLoading(false);
    }
  }

  useEffect(() => {
    if (state.error) toast.error(state.error);
    /* Сървърна грешка по поле от стъпка 1 → върни потребителя там.
       queueMicrotask: setState синхронно в effect чупи react-compiler lint. */
    if (state.fieldErrors?.name || state.fieldErrors?.businessCategory) {
      queueMicrotask(() => setStep(0));
    }
  }, [state]);

  function goNext() {
    if (step === 0) {
      if (name.trim().length < 2) {
        setStep1Error("Въведи име на магазина (поне 2 символа).");
        return;
      }
      if (!category) {
        setStep1Error("Избери категория.");
        return;
      }
      setStep1Error(null);
    }
    setStep((s) => Math.min(3, s + 1) as StepIndex);
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1) as StepIndex);
  }

  const isLast = step === 3;

  return (
    <div className="flex flex-col gap-6">
      {/* Вътрешен 3-точков индикатор за под-стъпките на магазина */}
      <ol className="flex items-center gap-2" aria-label="Стъпки за магазина">
        {STEPS.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <li key={s.label} data-active={active} className="flex flex-1 items-center gap-2">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold transition-colors ${
                  active
                    ? "bg-brand-500 text-surface-0"
                    : done
                      ? "bg-brand-100 text-brand-700"
                      : "border border-surface-300 bg-surface-0 text-ink-500"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`hidden text-sm font-medium sm:block ${active ? "text-ink-900" : "text-ink-500"}`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span aria-hidden className="h-px flex-1 bg-surface-200" />
              )}
            </li>
          );
        })}
      </ol>

      <Card>
        <form
          action={formAction}
          /* Предпазна мрежа: блокирай всеки submit, който не идва от последната
             стъпка (напр. race при смяна на бутоните) → магазинът се създава
             само при явно натискане на „Създай магазина". */
          onSubmit={(e) => {
            if (!isLast) e.preventDefault();
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <input type="hidden" name="workingHours" value={JSON.stringify({ days })} />
          <input type="hidden" name="complexityMode" value={complexityMode} />

          {/* Стъпка 1 — Основно (винаги в DOM; скрита, ако не е активна) */}
          <div className={step === 0 ? "flex flex-col gap-4" : "hidden"}>
            <div className="flex flex-col gap-1.5">
              <Input
                label="Име на магазина"
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={checkSlug}
                error={state.fieldErrors?.name ?? step1Error ?? undefined}
                hint={slug ? undefined : "От името се създава публичният адрес на магазина."}
              />
              {/* Live адрес: показва предвидения slug + бележка при заетост */}
              {slugLoading ? (
                <p className="text-sm text-ink-500">Проверяваме адреса…</p>
              ) : (
                slug && (
                  <p className="text-sm text-ink-500">
                    Адрес:{" "}
                    <span className="font-medium text-ink-900">/s/{slug.slug}</span>
                    {slug.taken && (
                      <span className="text-ink-500">
                        {" "}
                        — това име вече се ползва, затова адресът получава номер.
                      </span>
                    )}
                  </p>
                )
              )}
            </div>
            <Select
              label="Категория на бизнеса"
              name="businessCategory"
              required
              options={categoryOptions}
              placeholder="Избери категория"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              error={state.fieldErrors?.businessCategory}
            />
            <Textarea
              label="Описание"
              name="description"
              placeholder="С какво се занимава твоят бизнес?"
              error={state.fieldErrors?.description}
            />
          </div>

          {/* Стъпка 2 — Контакти и локация */}
          <div className={step === 1 ? "flex flex-col gap-4" : "hidden"}>
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              onSelect={(result) => {
                setAddress(result.fullAddress);
                if (result.city) setCity(result.city);
              }}
              error={state.fieldErrors?.address}
            />
            <Input
              label="Град"
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              hint="Попълва се автоматично при избор на адрес."
              error={state.fieldErrors?.city}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Телефон"
                name="phone"
                type="tel"
                placeholder="0888 123 456"
                error={state.fieldErrors?.phone}
              />
              <Input
                label="Имейл за връзка"
                name="email"
                type="email"
                error={state.fieldErrors?.email}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Facebook"
                name="facebook"
                placeholder="https://facebook.com/..."
                error={state.fieldErrors?.facebook}
              />
              <Input
                label="Instagram"
                name="instagram"
                placeholder="https://instagram.com/..."
                error={state.fieldErrors?.instagram}
              />
            </div>
          </div>

          {/* Стъпка 3 — Работно време */}
          <div className={step === 2 ? "flex flex-col gap-4" : "hidden"}>
            <WorkingHoursEditor value={days} onChange={setDays} />
          </div>

          {/* Стъпка 4 — Сложност */}
          <div className={step === 3 ? "flex flex-col gap-3" : "hidden"}>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink-900">Колко подробен да е панелът?</span>
              <span className="text-sm text-ink-500">
                Можеш да смениш това по всяко време от менюто горе. Започни просто.
              </span>
            </div>
            {MODE_META.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setComplexityMode(m.value)}
                aria-pressed={complexityMode === m.value}
                className={`flex flex-col gap-0.5 rounded-card border p-4 text-left transition-colors ${
                  complexityMode === m.value
                    ? "border-brand-500 bg-brand-50"
                    : "border-surface-200 bg-surface-0 hover:border-surface-300"
                }`}
              >
                <span className="text-sm font-bold text-ink-900">{m.label}</span>
                <span className="text-xs text-ink-500">{m.description}</span>
              </button>
            ))}
          </div>

          {state.error && <p className="text-sm text-danger-600">{state.error}</p>}

          {/* Навигация. Стъпки 2–3 нямат задължителни полета — „Напред" минава
              напред без да изисква попълване (затова няма отделен „Прескочи"). */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              {step > 0 && (
                <Button type="button" variant="ghost" onClick={goBack}>
                  ← Назад
                </Button>
              )}
            </div>
            {/* Двата бутона имат различни key → React ги третира като отделни
                DOM нодове (не преизползва един и същ). Иначе клик на „Напред",
                чийто бутон при re-render става type=submit, задейства нативен
                submit насред обработката на click event-а. */}
            {isLast ? (
              <Button key="create" type="submit" loading={pending}>
                Създай магазина
              </Button>
            ) : (
              <Button key="next" type="button" onClick={goNext}>
                Напред →
              </Button>
            )}
          </div>

          {/* Подсказка, че по-нататъшните стъпки са по избор */}
          {step > 0 && (
            <p className="text-center text-xs text-ink-500">
              По избор — можеш да добавиш това и по-късно от таб „Магазин“.
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
