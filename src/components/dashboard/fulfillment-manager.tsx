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
import { isValidBgIban } from "@/lib/iban";
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
  /** Рендерира само едната секция (за табове). undefined = двете (обратна съвместимост). */
  only?: "shipping" | "payment";
  /** Магазинът има поне един свързан куриер → показва Куриер/Доставка до полетата. */
  hasCourier?: boolean;
}

type ShippingDraft = {
  id: string | null;
  type: string;
  name: string;
  price: string;
  freeOver: string;
  /** null = не се показва време за доставка; масив = включено. */
  deliveryHours: WorkingDay[] | null;
  /** "" = ръчен куриер; иначе Еконт/Спиди. */
  courierProvider: string;
  deliveryTarget: string;
};
type PaymentDraft = { id: string | null; type: string; name: string; details: string };

export function FulfillmentManager({
  shipping,
  payment,
  zones,
  only,
  hasCourier = false,
}: FulfillmentManagerProps) {
  const router = useRouter();
  const showShipping = !only || only === "shipping";
  const showPayment = !only || only === "payment";
  const zonesByMethod = (methodId: string) => zones.filter((z) => z.shippingMethodId === methodId);
  const [shippingDraft, setShippingDraft] = useState<ShippingDraft | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);
  const [toDelete, setToDelete] = useState<{ kind: "shipping" | "payment"; id: string; name: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  /* Снапшот на draft-а при отваряне (JSON) — за dirty-guard на „Запази".
     Сетва се само при отваряне за редакция; create → null → винаги dirty. */
  const [shippingOpened, setShippingOpened] = useState<string | null>(null);
  const [paymentOpened, setPaymentOpened] = useState<string | null>(null);
  const shippingDirty =
    shippingOpened === null || JSON.stringify(shippingDraft) !== shippingOpened;
  const paymentDirty = paymentOpened === null || JSON.stringify(paymentDraft) !== paymentOpened;

  /* Отваряне на draft: за редакция пазим снапшот (dirty-guard); за нов — null. */
  function openShipping(draft: ShippingDraft) {
    setShippingDraft(draft);
    setShippingOpened(draft.id === null ? null : JSON.stringify(draft));
  }
  function openPayment(draft: PaymentDraft) {
    setPaymentDraft(draft);
    setPaymentOpened(draft.id === null ? null : JSON.stringify(draft));
  }
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
      {showShipping && (
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-ink-900">Методи за доставка</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              openShipping({
                id: null,
                type: "courier",
                name: "",
                price: "",
                freeOver: "",
                deliveryHours: null,
                courierProvider: "",
                deliveryTarget: "address",
              })
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
                  openShipping({
                    id: m.id,
                    type: m.type,
                    name: m.name,
                    price: centsToInput(m.priceCents),
                    freeOver: centsToInput(m.freeOverCents),
                    deliveryHours: m.deliveryHours ? parseWorkingHours(m.deliveryHours) : null,
                    courierProvider: m.courierProvider ?? "",
                    deliveryTarget: m.deliveryTarget ?? "address",
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
      )}

      {showPayment && (
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-ink-900">Методи за плащане</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openPayment({ id: null, type: "cod", name: "", details: "" })}
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
                  openPayment({ id: m.id, type: m.type, name: m.name, details: m.details })
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
      )}

      {showShipping && (
      <Drawer
        open={shippingDraft !== null}
        onClose={() => setShippingDraft(null)}
        title={shippingDraft?.id ? "Редактирай доставка" : "Нов метод за доставка"}
        footer={
          <Button onClick={handleSaveShipping} loading={saving} disabled={!shippingDirty}>
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

            {/* Куриерска интеграция — само за courier метод и ако магазинът има свързан куриер. */}
            {hasCourier && shippingDraft.type === "courier" && (
              <div className="grid gap-4 border-t border-surface-100 pt-4 sm:grid-cols-2">
                <Select
                  label="Куриер"
                  hint="За автоматична товарителница"
                  options={[
                    { value: "", label: "Ръчно (без куриер)" },
                    { value: "econt", label: "Еконт" },
                    { value: "speedy", label: "Спиди" },
                  ]}
                  value={shippingDraft.courierProvider}
                  onChange={(e) =>
                    setShippingDraft({ ...shippingDraft, courierProvider: e.target.value })
                  }
                />
                <Select
                  label="Доставка до"
                  options={[
                    { value: "address", label: "Адрес" },
                    { value: "office", label: "Офис на куриера" },
                  ]}
                  value={shippingDraft.deliveryTarget}
                  onChange={(e) =>
                    setShippingDraft({ ...shippingDraft, deliveryTarget: e.target.value })
                  }
                  disabled={shippingDraft.courierProvider === ""}
                />
              </div>
            )}

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
      )}

      {showPayment && (
      <Drawer
        open={paymentDraft !== null}
        onClose={() => setPaymentDraft(null)}
        title={paymentDraft?.id ? "Редактирай плащане" : "Нов метод за плащане"}
        footer={
          <Button onClick={handleSavePayment} loading={saving} disabled={!paymentDirty}>
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
              onChange={(e) => {
                setPaymentDraft({ ...paymentDraft, details: e.target.value });
                /* Изчисти грешката веднага щом стойността стане валидна (докато пише). */
                if (errors.details) {
                  const ok =
                    paymentDraft.type !== "bank_transfer" || isValidBgIban(e.target.value);
                  if (ok) setErrors((prev) => ({ ...prev, details: "" }));
                }
              }}
              onBlur={(e) => {
                /* Валидирай IBAN при напускане на полето — само за банков превод. */
                if (paymentDraft.type !== "bank_transfer") return;
                const value = e.target.value.trim();
                if (value !== "" && !isValidBgIban(value)) {
                  setErrors((prev) => ({
                    ...prev,
                    details: "Въведи валиден IBAN (напр. BG80 BNBG 9661 1020 3456 78)",
                  }));
                }
              }}
              error={errors.details}
              hint="Показва се на купувача при избор на метода."
            />
          </div>
        )}
      </Drawer>
      )}

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
