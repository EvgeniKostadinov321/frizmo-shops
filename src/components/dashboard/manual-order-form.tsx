"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createManualOrder } from "@/actions/orders";
import type { CartProductView } from "@/db/queries/cart";
import { Button, Icon, Input, PriceInput, Select, Textarea } from "@/components/ui";
import { formatPrice, toCents } from "@/lib/money";
import { priceCart, type CartLine } from "@/lib/pricing";

interface ManualOrderFormProps {
  products: CartProductView[];
  shippingMethods: { id: string; name: string; priceCents: number; freeOverCents: number | null }[];
  paymentMethods: { id: string; name: string }[];
  /** N9: подаръчна опаковка (настройката на магазина). */
  giftWrapEnabled?: boolean;
  giftWrapFeeCents?: number;
  /** N9: подаръчна картичка (текст поздрав) — независима от опаковката. */
  giftCardEnabled?: boolean;
}

/**
 * Форма за ръчна поръчка. Клиентът праща само productId/variantKey/qty —
 * сумата тук е ПРЕГЛЕД (същият priceCart), финалната се смята на сървъра.
 */
export function ManualOrderForm({
  products,
  shippingMethods,
  paymentMethods,
  giftWrapEnabled = false,
  giftWrapFeeCents = 0,
  giftCardEnabled = false,
}: ManualOrderFormProps) {
  const router = useRouter();

  const [lines, setLines] = useState<CartLine[]>([]);
  const [pickedProductId, setPickedProductId] = useState("");
  const [pickedVariantKey, setPickedVariantKey] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [note, setNote] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState(shippingMethods[0]?.id ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [overrideStr, setOverrideStr] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftCard, setGiftCard] = useState(false);
  const [giftNote, setGiftNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const pickedProduct = productMap.get(pickedProductId);

  const shipping = shippingMethods.find((m) => m.id === shippingMethodId);
  const overrideCents = overrideStr.trim() ? toCents(overrideStr) : null;
  const overrideInvalid = overrideStr.trim() !== "" && overrideCents === null;

  /* Преглед на сумите — същият pricing engine като сървъра. */
  const cart = useMemo(() => {
    if (lines.length === 0 || !shipping) return null;
    const option =
      overrideCents !== null
        ? { name: shipping.name, priceCents: overrideCents, freeOverCents: null }
        : shipping;
    return priceCart(lines, productMap, option);
  }, [lines, productMap, shipping, overrideCents]);

  function addLine() {
    if (!pickedProduct) return;
    const variantKey = pickedProduct.variants.length > 0 ? pickedVariantKey : null;
    if (pickedProduct.variants.length > 0 && !variantKey) {
      toast.error("Избери вариант.");
      return;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === pickedProduct.id && l.variantKey === variantKey);
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, qty: Math.min(999, l.qty + 1) } : l));
      }
      return [...prev, { productId: pickedProduct.id, variantKey, qty: 1 }];
    });
    setPickedProductId("");
    setPickedVariantKey("");
  }

  function setQty(index: number, qty: number) {
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) return;
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, qty } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (overrideInvalid) {
      toast.error("Невалидна цена на доставка.");
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    try {
      const result = await createManualOrder({
        customerName,
        customerPhone,
        customerEmail: customerEmail.trim(),
        address,
        city,
        note,
        shippingMethodId,
        paymentMethodId,
        shippingOverrideCents: overrideCents,
        giftWrap: giftWrapEnabled && giftWrap,
        giftCard: giftCardEnabled && giftCard,
        giftNote: giftCardEnabled && giftCard ? giftNote : "",
        lines,
      });
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success("Поръчката е създадена.");
      router.push(`/dashboard/orders/${result.data.orderId}`);
    } finally {
      setSubmitting(false);
    }
  }

  const lineLabel = (line: CartLine) => {
    const product = productMap.get(line.productId);
    if (!product) return "—";
    const variant = line.variantKey
      ? product.variants.find((v) => v.key === line.variantKey)
      : null;
    return variant ? `${product.name} — ${variant.label}` : product.name;
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
      {/* Лява колона: продукти + клиент */}
      <div className="flex flex-col gap-6 lg:col-span-2">
        {/* Продукти */}
        <section className="rounded-card border border-surface-200 bg-surface-0 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Продукти</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Продукт"
                options={products.map((p) => ({
                  value: p.id,
                  label: `${p.name} · ${formatPrice(p.promoPriceCents ?? p.priceCents)}`,
                }))}
                placeholder={products.length ? "Избери продукт…" : "Няма активни продукти"}
                value={pickedProductId}
                onChange={(e) => {
                  setPickedProductId(e.target.value);
                  setPickedVariantKey("");
                }}
                disabled={products.length === 0}
              />
              {pickedProduct && pickedProduct.variants.length > 0 && (
                <Select
                  label="Вариант"
                  options={pickedProduct.variants.map((v) => ({
                    value: v.key,
                    label: `${v.label}${v.priceCents !== null ? ` · ${formatPrice(v.priceCents)}` : ""}`,
                  }))}
                  placeholder="Избери вариант…"
                  value={pickedVariantKey}
                  onChange={(e) => setPickedVariantKey(e.target.value)}
                />
              )}
            </div>
            <div className="sm:self-end">
              <Button type="button" variant="secondary" onClick={addLine} disabled={!pickedProduct}>
                <Icon name="plus" size={16} />
                Добави
              </Button>
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">Още няма добавени продукти.</p>
          ) : (
            <ul className="mt-4 divide-y divide-surface-100 border-t border-surface-100">
              {lines.map((line, index) => {
                const priced = cart?.lines[index];
                return (
                  <li key={`${line.productId}:${line.variantKey ?? ""}`} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                      {lineLabel(line)}
                    </span>
                    {priced?.error && (
                      <span className="text-xs font-medium text-danger-600">
                        {priced.error === "insufficient_stock" || priced.error === "out_of_stock"
                          ? "Недостатъчна наличност"
                          : "Невалиден ред"}
                      </span>
                    )}
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={line.qty}
                      onChange={(e) => setQty(index, Number(e.target.value))}
                      aria-label="Количество"
                      className="h-11 w-20 rounded-control border border-surface-300 bg-surface-0 px-3 text-sm text-ink-900 focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
                    />
                    <span className="w-20 text-right font-medium tabular-nums text-ink-900">
                      {priced && !priced.error ? formatPrice(priced.lineTotalCents) : "—"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Премахни реда"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Icon name="trash" size={18} />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Клиент */}
        <section className="rounded-card border border-surface-200 bg-surface-0 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Клиент</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              label="Име"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              error={fieldErrors.customerName}
            />
            <Input
              label="Телефон"
              required
              type="tel"
              placeholder="0888 123 456"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              error={fieldErrors.customerPhone}
            />
            <Input
              label="Имейл (за известия)"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              error={fieldErrors.customerEmail}
            />
            <Input
              label="Град"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              error={fieldErrors.city}
            />
            <div className="sm:col-span-2">
              <Input
                label="Адрес"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                error={fieldErrors.address}
              />
            </div>
            <div className="sm:col-span-2">
              <Textarea
                label="Бележка"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Дясна колона: доставка/плащане + суми + submit */}
      <aside className="flex h-fit flex-col gap-4 rounded-card border border-surface-200 bg-surface-0 p-5 lg:sticky lg:top-6">
        <h2 className="font-display text-lg font-bold text-ink-900">Доставка и плащане</h2>

        <Select
          label="Доставка"
          options={shippingMethods.map((m) => ({
            value: m.id,
            label: `${m.name} · ${formatPrice(m.priceCents)}`,
          }))}
          value={shippingMethodId}
          onChange={(e) => setShippingMethodId(e.target.value)}
          error={fieldErrors.shippingMethodId}
        />
        <PriceInput
          label="Ръчна цена на доставка"
          hint="Остави празно за цената на метода."
          value={overrideStr}
          onChange={(e) => setOverrideStr(e.target.value)}
          error={overrideInvalid ? "Невалидна цена (пример: 4,50)" : undefined}
        />
        <Select
          label="Плащане"
          options={paymentMethods.map((m) => ({ value: m.id, label: m.name }))}
          value={paymentMethodId}
          onChange={(e) => setPaymentMethodId(e.target.value)}
          error={fieldErrors.paymentMethodId}
        />

        {(giftWrapEnabled || giftCardEnabled) && (
          <div className="flex flex-col gap-2">
            {giftWrapEnabled && (
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={giftWrap}
                  onChange={(e) => setGiftWrap(e.target.checked)}
                  className="size-5 shrink-0 rounded accent-brand-600"
                />
                <span className="text-sm font-medium text-ink-900">
                  Подаръчна опаковка
                  {giftWrapFeeCents > 0 && (
                    <span className="text-ink-500"> (+{formatPrice(giftWrapFeeCents)})</span>
                  )}
                </span>
              </label>
            )}
            {giftCardEnabled && (
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={giftCard}
                  onChange={(e) => setGiftCard(e.target.checked)}
                  className="size-5 shrink-0 rounded accent-brand-600"
                />
                <span className="text-sm font-medium text-ink-900">Подаръчна картичка</span>
              </label>
            )}
            {giftCardEnabled && giftCard && (
              <Input
                label="Текст за картичка"
                maxLength={200}
                value={giftNote}
                onChange={(e) => setGiftNote(e.target.value)}
              />
            )}
          </div>
        )}

        <div className="border-t border-surface-200 pt-4 text-sm">
          <div className="flex justify-between text-ink-700">
            <span>Междинна сума</span>
            <span className="tabular-nums">{cart ? formatPrice(cart.subtotalCents) : "—"}</span>
          </div>
          <div className="mt-1.5 flex justify-between text-ink-700">
            <span>Доставка</span>
            <span className="tabular-nums">
              {cart?.shipping ? formatPrice(cart.shipping.priceCents) : "—"}
            </span>
          </div>
          {giftWrapEnabled && giftWrap && giftWrapFeeCents > 0 && (
            <div className="mt-1.5 flex justify-between text-ink-700">
              <span>Подаръчна опаковка</span>
              <span className="tabular-nums">{formatPrice(giftWrapFeeCents)}</span>
            </div>
          )}
          <div className="mt-3 flex justify-between border-t border-surface-200 pt-3 font-bold text-ink-900">
            <span>Общо</span>
            <span className="tabular-nums">
              {cart
                ? formatPrice(cart.totalCents + (giftWrapEnabled && giftWrap ? giftWrapFeeCents : 0))
                : "—"}
            </span>
          </div>
        </div>

        <Button type="submit" loading={submitting} disabled={lines.length === 0 || Boolean(cart?.hasErrors)}>
          Създай поръчка
        </Button>
        <p className="text-xs text-ink-500">
          Поръчката влиза като „потвърдена“. Ако е даден имейл, клиентът получава
          известие.
        </p>
      </aside>
    </form>
  );
}
