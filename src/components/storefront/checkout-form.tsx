"use client";

import { useRouter } from "next/navigation";
import { cloneElement, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { priceCartAction } from "@/actions/cart";
import { validateCoupon } from "@/actions/coupons";
import { createOrder } from "@/actions/orders";
import type { PaymentMethod, ShippingMethod } from "@/db";
import {
  clearCart,
  getCartSnapshot,
  getServerCartSnapshot,
  onCartChange,
} from "@/lib/cart-storage";
import { formatPrice } from "@/lib/money";
import type { PricedCart } from "@/lib/pricing";

interface CheckoutFormProps {
  shopId: string;
  slug: string;
  base: string;
  shippingMethods: ShippingMethod[];
  paymentMethods: PaymentMethod[];
  /** N9: подаръчна опаковка (настройка на магазина; таксата е преглед — сървърът я прилага). */
  giftWrapEnabled?: boolean;
  giftWrapFeeCents?: number;
  /** N9: подаръчна картичка (текст поздрав) — независима от опаковката. */
  giftCardEnabled?: boolean;
}

/* Storefront полета — стилизирани със --sf-* променливите на темата. */
function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactElement<{ "aria-invalid"?: boolean }>;
}) {
  /* aria-invalid върху input-а → SR го обявява като невалиден И дава хука за
     авто-фокус на първото невалидно поле след submit. */
  const control = error ? cloneElement(children, { "aria-invalid": true }) : children;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-(--sf-text)">
        {label}
        {required && <span className="text-(--sf-accent)"> *</span>}
      </span>
      {control}
      {error && (
        <span role="alert" className="text-sm text-(--sf-accent)">
          {error}
        </span>
      )}
    </label>
  );
}

/* Брандиран чекбокс за storefront (--sf-* токени) — native accent-color е грозен
   и различен на всеки браузър. Реалният input е скрит peer; кутията се рисува тук. */
function SfCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-(--sf-text)">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-(--sf-border) bg-(--sf-surface-raised) text-(--sf-on-primary) transition-colors peer-checked:border-(--sf-primary) peer-checked:bg-(--sf-primary) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--sf-primary) [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <span className="flex items-center gap-2">{children}</span>
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3 text-(--sf-text) placeholder:text-(--sf-muted)";

/* Контактните полета се помнят per-магазин: прекъснат checkout / следваща
   поръчка = попълнена форма. Бележката и методите нарочно не се пазят. */
const PERSISTED_FIELDS = ["customerName", "customerPhone", "customerEmail", "address", "city"] as const;
const persistKey = (shopId: string) => `frizmo-checkout-${shopId}`;

function readPersisted(shopId: string): Partial<Record<(typeof PERSISTED_FIELDS)[number], string>> {
  try {
    const raw = window.localStorage.getItem(persistKey(shopId));
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const out: Partial<Record<(typeof PERSISTED_FIELDS)[number], string>> = {};
    for (const field of PERSISTED_FIELDS) {
      if (typeof parsed[field] === "string") out[field] = parsed[field] as string;
    }
    return out;
  } catch {
    return {};
  }
}

export function CheckoutForm({
  shopId,
  slug,
  base,
  shippingMethods,
  paymentMethods,
  giftWrapEnabled = false,
  giftWrapFeeCents = 0,
  giftCardEnabled = false,
}: CheckoutFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const stored = useSyncExternalStore(
    (cb) => onCartChange(shopId, cb),
    () => getCartSnapshot(shopId),
    getServerCartSnapshot,
  );

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    address: "",
    city: "",
    note: "",
    shippingMethodId: shippingMethods[0]?.id ?? "",
    paymentMethodId: paymentMethods[0]?.id ?? "",
    website: "", // honeypot
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<PricedCart | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /* Промо код: въведен текст, приложен код (потвърден от сървъра) + състояние. */
  const [couponInput, setCouponInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  /* N9: подаръчна опаковка (такса) + картичка (текст) — независими опции. */
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftCard, setGiftCard] = useState(false);
  const [giftNote, setGiftNote] = useState("");

  /* Еднократно зареждане на запомнените полета (queueMicrotask — setState
     синхронно в effect чупи react-compiler lint-а). */
  useEffect(() => {
    const saved = readPersisted(shopId);
    if (Object.keys(saved).length === 0) return;
    queueMicrotask(() => setForm((f) => ({ ...f, ...saved })));
  }, [shopId]);

  const storedKey = JSON.stringify(stored);
  const shipping = shippingMethods.find((m) => m.id === form.shippingMethodId);
  const isPickup = shipping?.type === "pickup";

  /* Сървърно преизчисление при промяна на количката (без доставка — тя долу).
     Ако има приложен купон, преизчисляваме с него (validateCoupon), за да не
     изчезне отстъпката при смяна на количеството. */
  useEffect(() => {
    if (stored.length === 0) return;
    let cancelled = false;
    const load = appliedCode
      ? validateCoupon(slug, appliedCode, stored).then((r) =>
          r.ok ? r.data.cart : null,
        )
      : priceCartAction(slug, stored).then((r) => (r.ok ? r.data.cart : null));
    load.then((c) => {
      if (!cancelled && c) setCart(c);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, storedKey, appliedCode]);

  /* Отстъпката идва от cart.discountCents, но само ако приложеният код още
     съвпада с cart-а (при смяна на количката cart се презарежда без купон). */
  const discountCents = appliedCode && cart?.appliedCouponCode === appliedCode
    ? cart.discountCents
    : 0;

  const totals = useMemo(() => {
    if (!cart || !shipping) return null;
    /* Безплатна доставка по ОРИГИНАЛНИЯ subtotal (купонът не я отнема). */
    const free =
      shipping.freeOverCents !== null && cart.subtotalCents >= shipping.freeOverCents;
    const shippingCents = free ? 0 : shipping.priceCents;
    const giftCents = giftWrapEnabled && giftWrap ? giftWrapFeeCents : 0;
    return {
      free,
      shippingCents,
      giftCents,
      totalCents: cart.subtotalCents - discountCents + shippingCents + giftCents,
    };
  }, [cart, shipping, discountCents, giftWrap, giftWrapEnabled, giftWrapFeeCents]);

  if (stored.length === 0) {
    return (
      <p className="py-16 text-center text-(--sf-muted)">
        Количката е празна — няма какво да поръчаш.
      </p>
    );
  }

  function set(field: string, value: string) {
    const next = { ...form, [field]: value };
    setForm(next);
    if ((PERSISTED_FIELDS as readonly string[]).includes(field)) {
      try {
        window.localStorage.setItem(
          persistKey(shopId),
          JSON.stringify(Object.fromEntries(PERSISTED_FIELDS.map((k) => [k, next[k]]))),
        );
      } catch {
        /* localStorage пълен/недостъпен — формата работи и без запомняне */
      }
    }
  }

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponBusy(true);
    setCouponMsg(null);
    try {
      const result = await validateCoupon(slug, code, stored);
      if (!result.ok) {
        setCouponMsg({ ok: false, text: result.error });
        return;
      }
      setCart(result.data.cart);
      setAppliedCode(result.data.cart.appliedCouponCode);
      setCouponMsg({ ok: true, text: "Промо кодът е приложен!" });
    } finally {
      setCouponBusy(false);
    }
  }

  function removeCoupon() {
    setAppliedCode("");
    setCouponInput("");
    setCouponMsg(null);
    /* effect-ът презарежда cart-а без купон при промяна на appliedCode. */
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await createOrder(slug, {
        ...form,
        lines: stored,
        couponCode: appliedCode,
        giftWrap: giftWrapEnabled && giftWrap,
        giftCard: giftCardEnabled && giftCard,
        giftNote: giftCardEnabled && giftCard ? giftNote : "",
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setError(result.error);
        /* Фокус на първото невалидно поле (WCAG focus-management). */
        queueMicrotask(() =>
          formRef.current
            ?.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus(),
        );
        return;
      }
      clearCart(shopId);
      router.push(`${base}/order/${result.data.orderId}?t=${result.data.token}`);
    } catch {
      /* Мрежов срив/timeout: попълненото се пази (localStorage), количката е
         непокътната → потребителят просто натиска пак. Без тиха гола грешка. */
      setError("Няма връзка със сървъра. Провери интернета и опитай пак.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="grid gap-8 md:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <Field label="Име и фамилия" required error={fieldErrors.customerName}>
          <input
            className={inputClass}
            name="name"
            value={form.customerName}
            onChange={(e) => set("customerName", e.target.value)}
            autoComplete="name"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Телефон" required error={fieldErrors.customerPhone}>
            <input
              className={inputClass}
              type="tel"
              name="tel"
              placeholder="0888 123 456"
              value={form.customerPhone}
              onChange={(e) => set("customerPhone", e.target.value)}
              autoComplete="tel"
            />
          </Field>
          <Field label="Имейл (за потвърждение)" error={fieldErrors.customerEmail}>
            <input
              className={inputClass}
              type="email"
              name="email"
              value={form.customerEmail}
              onChange={(e) => set("customerEmail", e.target.value)}
              autoComplete="email"
            />
          </Field>
        </div>

        <Field label="Доставка" required error={fieldErrors.shippingMethodId}>
          <div className="flex flex-col gap-2">
            {shippingMethods.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-(--sf-radius) border p-3 ${
                  form.shippingMethodId === m.id
                    ? "border-(--sf-primary)"
                    : "border-(--sf-border)"
                }`}
              >
                <span className="flex items-center gap-2 text-sm text-(--sf-text)">
                  <input
                    type="radio"
                    name="shipping"
                    checked={form.shippingMethodId === m.id}
                    onChange={() => set("shippingMethodId", m.id)}
                  />
                  {m.name}
                </span>
                <span className="text-sm font-medium text-(--sf-text)">
                  {m.freeOverCents !== null && cart && cart.subtotalCents >= m.freeOverCents
                    ? "Безплатна"
                    : formatPrice(m.priceCents)}
                </span>
              </label>
            ))}
          </div>
        </Field>

        {!isPickup && (
          <>
            <Field label="Адрес за доставка" required error={fieldErrors.address}>
              <input
                className={inputClass}
                name="street-address"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                autoComplete="street-address"
              />
            </Field>
            <Field label="Град" error={fieldErrors.city}>
              <input
                className={inputClass}
                name="city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                autoComplete="address-level2"
              />
            </Field>
          </>
        )}

        <Field label="Плащане" required error={fieldErrors.paymentMethodId}>
          <div className="flex flex-col gap-2">
            {paymentMethods.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer flex-col gap-1 rounded-(--sf-radius) border p-3 ${
                  form.paymentMethodId === m.id ? "border-(--sf-primary)" : "border-(--sf-border)"
                }`}
              >
                <span className="flex items-center gap-2 text-sm text-(--sf-text)">
                  <input
                    type="radio"
                    name="payment"
                    checked={form.paymentMethodId === m.id}
                    onChange={() => set("paymentMethodId", m.id)}
                  />
                  {m.name}
                </span>
                {m.details && form.paymentMethodId === m.id && (
                  <span className="pl-6 text-xs text-(--sf-muted)">{m.details}</span>
                )}
              </label>
            ))}
          </div>
        </Field>

        {/* N9: подаръчни опции — опаковка и/или картичка (само включените от магазина) */}
        {(giftWrapEnabled || giftCardEnabled) && (
          <div className="flex flex-col gap-3 rounded-(--sf-radius) border border-(--sf-border) p-3">
            {giftWrapEnabled && (
              <SfCheckbox checked={giftWrap} onChange={setGiftWrap}>
                Опаковай поръчката като подарък
                {giftWrapFeeCents > 0 && (
                  <span className="text-(--sf-muted)">(+{formatPrice(giftWrapFeeCents)})</span>
                )}
              </SfCheckbox>
            )}
            {giftCardEnabled && (
              <SfCheckbox checked={giftCard} onChange={setGiftCard}>
                Добави подаръчна картичка
              </SfCheckbox>
            )}
            {giftCardEnabled && giftCard && (
              <Field label="Текст за картичка" error={fieldErrors.giftNote}>
                <input
                  className={inputClass}
                  maxLength={200}
                  value={giftNote}
                  onChange={(e) => setGiftNote(e.target.value)}
                  placeholder="Напр. Честит рожден ден!"
                />
              </Field>
            )}
          </div>
        )}

        <Field label="Бележка към поръчката" error={fieldErrors.note}>
          <textarea
            className={`${inputClass} h-20 resize-y py-2`}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>

        {/* Honeypot — скрито от хора, ботовете го попълват */}
        <div aria-hidden className="absolute left-[-9999px] size-px overflow-hidden">
          <label>
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </label>
        </div>
      </div>

      <aside className="flex h-fit flex-col gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4">
        <h2 className="font-bold text-(--sf-text)">Твоята поръчка</h2>
        {cart?.lines.map((line) => (
          <div key={`${line.productId}-${line.variantKey ?? ""}`} className="flex justify-between gap-2 text-sm">
            <span className="text-(--sf-muted)">
              {line.productName}
              {line.variantLabel && ` (${line.variantLabel})`} ×{line.qty}
            </span>
            <span className="shrink-0 text-(--sf-text)">{formatPrice(line.lineTotalCents)}</span>
          </div>
        ))}
        <hr className="border-(--sf-border)" />
        {cart && (
          <div className="flex justify-between text-sm text-(--sf-muted)">
            <span>Междинна сума</span>
            <span>{formatPrice(cart.subtotalCents)}</span>
          </div>
        )}

        {/* Промо код */}
        {appliedCode && discountCents > 0 ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-(--sf-text)">
              Отстъпка (<span className="font-medium">{appliedCode}</span>)
            </span>
            <span className="flex items-center gap-2">
              <span className="text-(--sf-text)">−{formatPrice(discountCents)}</span>
              <button
                type="button"
                onClick={removeCoupon}
                className="text-xs text-(--sf-muted) underline underline-offset-2 hover:text-(--sf-text)"
              >
                махни
              </button>
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Поле + бутон в общ „pill" бордер — бутонът е вътре вдясно, не
                стърчи навън. min-w-0 пази input-а да не прелива каре-то. */}
            <div className="flex items-stretch overflow-hidden rounded-(--sf-radius) border border-(--sf-border) focus-within:border-(--sf-primary)">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCoupon();
                  }
                }}
                placeholder="Промо код"
                className="h-10 w-0 min-w-0 flex-1 bg-transparent px-3 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:outline-none"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={couponBusy || !couponInput.trim()}
                className="shrink-0 border-l border-(--sf-border) px-3 text-sm font-medium text-(--sf-primary) transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {couponBusy ? "…" : "Приложи"}
              </button>
            </div>
            {couponMsg && (
              <span className={`text-xs ${couponMsg.ok ? "text-(--sf-primary)" : "text-(--sf-accent)"}`}>
                {couponMsg.text}
              </span>
            )}
          </div>
        )}

        {totals && (
          <div className="flex justify-between text-sm text-(--sf-muted)">
            <span>Доставка</span>
            <span>{totals.free ? "Безплатна" : formatPrice(totals.shippingCents)}</span>
          </div>
        )}
        {totals && totals.giftCents > 0 && (
          <div className="flex justify-between text-sm text-(--sf-muted)">
            <span>Подаръчна опаковка</span>
            <span>{formatPrice(totals.giftCents)}</span>
          </div>
        )}
        {totals && (
          <div className="flex justify-between text-lg font-bold text-(--sf-text)">
            <span>Общо</span>
            <span>{formatPrice(totals.totalCents)}</span>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-(--sf-accent)">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || !cart || cart.hasErrors}
          className="sf-cta h-12 rounded-(--sf-radius) bg-(--sf-primary) font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Изпращане..." : "Потвърди поръчката"}
        </button>
        <p className="text-xs text-(--sf-muted)">
          С поръчката приемаш <a href={`${base}/terms`} className="underline">условията</a> на магазина.
        </p>
      </aside>
    </form>
  );
}
