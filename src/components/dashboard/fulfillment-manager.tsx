"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  deletePaymentMethod,
  deleteShippingMethod,
  savePaymentMethod,
  saveShippingMethod,
  togglePaymentMethod,
  toggleShippingMethod,
} from "@/actions/fulfillment";
import type { PaymentMethod, ShippingMethod } from "@/db";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  Icon,
  Input,
  PriceInput,
  Select,
  Textarea,
} from "@/components/ui";
import { centsToInput, formatPrice } from "@/lib/money";
import { PAYMENT_TYPES, SHIPPING_TYPES } from "@/schemas/fulfillment";

interface FulfillmentManagerProps {
  shipping: ShippingMethod[];
  payment: PaymentMethod[];
}

type ShippingDraft = { id: string | null; type: string; name: string; price: string; freeOver: string };
type PaymentDraft = { id: string | null; type: string; name: string; details: string };

export function FulfillmentManager({ shipping, payment }: FulfillmentManagerProps) {
  const router = useRouter();
  const [shippingDraft, setShippingDraft] = useState<ShippingDraft | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);
  const [toDelete, setToDelete] = useState<{ kind: "shipping" | "payment"; id: string; name: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    const result = await action();
    if (!result.ok) toast.error(result.error ?? "Грешка.");
    router.refresh();
  }

  async function handleSaveShipping() {
    if (!shippingDraft) return;
    setSaving(true);
    setErrors({});
    try {
      const result = await saveShippingMethod(shippingDraft.id, shippingDraft);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Запазено.");
      setShippingDraft(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePayment() {
    if (!paymentDraft) return;
    setSaving(true);
    setErrors({});
    try {
      const result = await savePaymentMethod(paymentDraft.id, paymentDraft);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Запазено.");
      setPaymentDraft(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink-900">Плащане и доставка</h1>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-ink-900">Методи за доставка</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setShippingDraft({ id: null, type: "courier", name: "", price: "", freeOver: "" })
            }
          >
            + Добави
          </Button>
        </div>
        {shipping.map((m) => (
          <div
            key={m.id}
            className={`flex items-center justify-between gap-2 rounded-control border border-surface-200 px-3 py-2 ${
              m.active ? "" : "opacity-60"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink-900">{m.name}</p>
              <p className="text-xs text-ink-500">
                {formatPrice(m.priceCents)}
                {m.freeOverCents !== null && ` · безплатна над ${formatPrice(m.freeOverCents)}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!m.active && <Badge tone="neutral">Изключен</Badge>}
              <Button
                variant="ghost"
                size="sm"
                aria-label={m.active ? "Изключи" : "Включи"}
                onClick={() => run(() => toggleShippingMethod({ id: m.id }))}
              >
                <Icon name={m.active ? "eye" : "eye-off"} size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Редактирай"
                onClick={() =>
                  setShippingDraft({
                    id: m.id,
                    type: m.type,
                    name: m.name,
                    price: centsToInput(m.priceCents),
                    freeOver: centsToInput(m.freeOverCents),
                  })
                }
              >
                <Icon name="pencil" size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Изтрий"
                onClick={() => setToDelete({ kind: "shipping", id: m.id, name: m.name })}
              >
                <Icon name="trash" size={18} />
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-ink-900">Методи за плащане</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPaymentDraft({ id: null, type: "cod", name: "", details: "" })}
          >
            + Добави
          </Button>
        </div>
        {payment.map((m) => (
          <div
            key={m.id}
            className={`flex items-center justify-between gap-2 rounded-control border border-surface-200 px-3 py-2 ${
              m.active ? "" : "opacity-60"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink-900">{m.name}</p>
              {m.details && <p className="truncate text-xs text-ink-500">{m.details}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!m.active && <Badge tone="neutral">Изключен</Badge>}
              <Button
                variant="ghost"
                size="sm"
                aria-label={m.active ? "Изключи" : "Включи"}
                onClick={() => run(() => togglePaymentMethod({ id: m.id }))}
              >
                <Icon name={m.active ? "eye" : "eye-off"} size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Редактирай"
                onClick={() =>
                  setPaymentDraft({ id: m.id, type: m.type, name: m.name, details: m.details })
                }
              >
                <Icon name="pencil" size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Изтрий"
                onClick={() => setToDelete({ kind: "payment", id: m.id, name: m.name })}
              >
                <Icon name="trash" size={18} />
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <Drawer
        open={shippingDraft !== null}
        onClose={() => setShippingDraft(null)}
        title={shippingDraft?.id ? "Редактирай доставка" : "Нов метод за доставка"}
        footer={
          <Button onClick={handleSaveShipping} loading={saving}>
            Запази
          </Button>
        }
      >
        {shippingDraft && (
          <div className="flex flex-col gap-4">
            <Select
              label="Тип"
              options={SHIPPING_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              value={shippingDraft.type}
              onChange={(e) => setShippingDraft({ ...shippingDraft, type: e.target.value })}
            />
            <Input
              label="Име"
              required
              placeholder="Куриер до адрес"
              value={shippingDraft.name}
              onChange={(e) => setShippingDraft({ ...shippingDraft, name: e.target.value })}
              error={errors.name}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <PriceInput
                label="Цена"
                required
                value={shippingDraft.price}
                onChange={(e) => setShippingDraft({ ...shippingDraft, price: e.target.value })}
                error={errors.price}
              />
              <PriceInput
                label="Безплатна над"
                value={shippingDraft.freeOver}
                onChange={(e) => setShippingDraft({ ...shippingDraft, freeOver: e.target.value })}
                error={errors.freeOver}
                hint="Празно = никога"
              />
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        open={paymentDraft !== null}
        onClose={() => setPaymentDraft(null)}
        title={paymentDraft?.id ? "Редактирай плащане" : "Нов метод за плащане"}
        footer={
          <Button onClick={handleSavePayment} loading={saving}>
            Запази
          </Button>
        }
      >
        {paymentDraft && (
          <div className="flex flex-col gap-4">
            <Select
              label="Тип"
              options={PAYMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              value={paymentDraft.type}
              onChange={(e) => setPaymentDraft({ ...paymentDraft, type: e.target.value })}
            />
            <Input
              label="Име"
              required
              placeholder="Наложен платеж"
              value={paymentDraft.name}
              onChange={(e) => setPaymentDraft({ ...paymentDraft, name: e.target.value })}
              error={errors.name}
            />
            <Textarea
              label="Детайли"
              rows={2}
              placeholder="IBAN при банков превод, инструкции..."
              value={paymentDraft.details}
              onChange={(e) => setPaymentDraft({ ...paymentDraft, details: e.target.value })}
              error={errors.details}
              hint="Показва се на купувача при избор на метода."
            />
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() =>
          run(() =>
            toDelete!.kind === "shipping"
              ? deleteShippingMethod({ id: toDelete!.id })
              : deletePaymentMethod({ id: toDelete!.id }),
          )
        }
        message={`Изтриване на „${toDelete?.name}“? Направените поръчки пазят своя запис и не се променят.`}
      />
    </div>
  );
}
