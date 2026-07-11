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
import type { PaymentMethod, ShippingMethod, ShippingZone } from "@/db";
import { ShippingZonesEditor } from "@/components/dashboard/shipping-zones-editor";
import {
  Badge,
  Button,
  Card,
  Checkbox,
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
import { WorkingHoursEditor } from "@/components/dashboard/working-hours-editor";
import {
  defaultWorkingDays,
  parseWorkingHours,
  type WorkingDay,
} from "@/lib/working-hours";

interface FulfillmentManagerProps {
  shipping: ShippingMethod[];
  payment: PaymentMethod[];
  zones: ShippingZone[];
}

type ShippingDraft = {
  id: string | null;
  type: string;
  name: string;
  price: string;
  freeOver: string;
  /** null = не се показва време за доставка; масив = включено. */
  deliveryHours: WorkingDay[] | null;
};
type PaymentDraft = { id: string | null; type: string; name: string; details: string };

export function FulfillmentManager({ shipping, payment, zones }: FulfillmentManagerProps) {
  const router = useRouter();
  const zonesByMethod = (methodId: string) => zones.filter((z) => z.shippingMethodId === methodId);
  const [shippingDraft, setShippingDraft] = useState<ShippingDraft | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);
  const [toDelete, setToDelete] = useState<{ kind: "shipping" | "payment"; id: string; name: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  /* Кой ред има текущо действие (toggle) — за spinner на бутона. */
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setPendingId(id);
    try {
      const result = await action();
      if (!result.ok) toast.error(result.error ?? "Грешка.");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleSaveShipping() {
    if (!shippingDraft) return;
    setSaving(true);
    setErrors({});
    try {
      const result = await saveShippingMethod(shippingDraft.id, {
        ...shippingDraft,
        deliveryHours: shippingDraft.deliveryHours ? { days: shippingDraft.deliveryHours } : null,
      });
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
              setShippingDraft({ id: null, type: "courier", name: "", price: "", freeOver: "", deliveryHours: null })
            }
          >
            + Добави
          </Button>
        </div>
        {shipping.map((m) => (
          <div
            key={m.id}
            className={`rounded-control border border-surface-200 px-3 py-2 ${
              m.active ? "" : "opacity-60"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-ink-900">{m.name}</p>
              <p className="text-xs text-ink-500">
                {m.type === "courier" && zonesByMethod(m.id).length > 0
                  ? "Цена по зона (виж отдолу)"
                  : formatPrice(m.priceCents)}
                {m.freeOverCents !== null && ` · безплатна над ${formatPrice(m.freeOverCents)}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!m.active && <Badge tone="neutral">Изключен</Badge>}
              <Button
                variant="ghost"
                size="sm"
                aria-label={m.active ? "Изключи" : "Включи"}
                loading={pendingId === m.id}
                onClick={() => run(m.id, () => toggleShippingMethod({ id: m.id }))}
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
                    deliveryHours: m.deliveryHours ? parseWorkingHours(m.deliveryHours) : null,
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
            {m.type === "courier" && (
              <ShippingZonesEditor methodId={m.id} zones={zonesByMethod(m.id)} />
            )}
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
                loading={pendingId === m.id}
                onClick={() => run(m.id, () => togglePaymentMethod({ id: m.id }))}
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

            {/* Опционално време за доставка — само инфо за клиента на checkout. */}
            <div className="flex flex-col gap-3 border-t border-surface-100 pt-4">
              <Checkbox
                label="Задай време за доставка"
                hint="Клиентът вижда в кои дни и часове доставяш. По избор."
                checked={shippingDraft.deliveryHours !== null}
                onChange={(e) =>
                  setShippingDraft({
                    ...shippingDraft,
                    deliveryHours: e.target.checked ? defaultWorkingDays() : null,
                  })
                }
              />
              {shippingDraft.deliveryHours !== null && (
                <WorkingHoursEditor
                  value={shippingDraft.deliveryHours}
                  onChange={(days) => setShippingDraft({ ...shippingDraft, deliveryHours: days })}
                />
              )}
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
          run(toDelete!.id, () =>
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
