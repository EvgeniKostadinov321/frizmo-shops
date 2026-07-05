"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { priceCartAction } from "@/actions/cart";
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
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-(--sf-text)">
        {label}
        {required && <span className="text-(--sf-accent)"> *</span>}
      </span>
      {children}
      {error && <span className="text-sm text-(--sf-accent)">{error}</span>}
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
}: CheckoutFormProps) {
  const router = useRouter();
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

  /* Сървърно преизчисление при промяна на количката (без доставка — тя долу). */
  useEffect(() => {
    if (stored.length === 0) return;
    let cancelled = false;
    priceCartAction(slug, stored).then((result) => {
      if (!cancelled && result.ok) setCart(result.data.cart);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, storedKey]);

  const totals = useMemo(() => {
    if (!cart || !shipping) return null;
    const free =
      shipping.freeOverCents !== null && cart.subtotalCents >= shipping.freeOverCents;
    const shippingCents = free ? 0 : shipping.priceCents;
    return { free, shippingCents, totalCents: cart.subtotalCents + shippingCents };
  }, [cart, shipping]);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await createOrder(slug, { ...form, lines: stored });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setError(result.error);
        return;
      }
      clearCart(shopId);
      router.push(`${base}/order/${result.data.orderId}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 md:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <Field label="Име и фамилия" required error={fieldErrors.customerName}>
          <input
            className={inputClass}
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
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                autoComplete="street-address"
              />
            </Field>
            <Field label="Град" error={fieldErrors.city}>
              <input
                className={inputClass}
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

        <Field label="Бележка към поръчката" error={fieldErrors.note}>
          <textarea
            className={`${inputClass} h-20 resize-y py-2`}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>

        {/* Honeypot — скрито от хора, ботовете го попълват */}
        <div aria-hidden className="absolute -left-2497 size-px overflow-hidden">
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
        {totals && (
          <div className="flex justify-between text-sm text-(--sf-muted)">
            <span>Доставка</span>
            <span>{totals.free ? "Безплатна" : formatPrice(totals.shippingCents)}</span>
          </div>
        )}
        {totals && (
          <div className="flex justify-between text-lg font-bold text-(--sf-text)">
            <span>Общо</span>
            <span>{formatPrice(totals.totalCents)}</span>
          </div>
        )}
        {error && <p className="text-sm font-medium text-(--sf-accent)">{error}</p>}
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
