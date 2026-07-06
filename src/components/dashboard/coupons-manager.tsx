"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteCoupon, saveCoupon, toggleCoupon } from "@/actions/coupons";
import type { Coupon } from "@/db";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  Icon,
  Input,
  Select,
} from "@/components/ui";
import { formatPrice } from "@/lib/money";

interface Draft {
  id: string | null;
  code: string;
  discountType: "percent" | "fixed";
  /** Показвана стойност: процент (percent) или евро (fixed). */
  value: string;
  minSubtotal: string; // евро
  maxUses: string;
  expiresAt: string; // yyyy-mm-dd
  active: boolean;
}

const EMPTY: Draft = {
  id: null,
  code: "",
  discountType: "percent",
  value: "",
  minSubtotal: "",
  maxUses: "",
  expiresAt: "",
  active: true,
};

/** Купон ред → чернова за формата. */
function toDraft(c: Coupon): Draft {
  return {
    id: c.id,
    code: c.code,
    discountType: c.discountType,
    value: c.discountType === "fixed" ? (c.discountValue / 100).toString() : c.discountValue.toString(),
    minSubtotal: c.minSubtotalCents ? (c.minSubtotalCents / 100).toString() : "",
    maxUses: c.maxUses?.toString() ?? "",
    expiresAt: c.expiresAt ? c.expiresAt.toISOString().slice(0, 10) : "",
    active: c.active,
  };
}

function discountLabel(c: Coupon): string {
  return c.discountType === "percent" ? `−${c.discountValue}%` : `−${formatPrice(c.discountValue)}`;
}

export function CouponsManager({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  /* Стабилен „сега" при mount — react-compiler забранява Date.now() в render. */
  const [now] = useState(() => Date.now());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; code: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function set(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setErrors({});
    try {
      const fd = new FormData();
      fd.set("code", draft.code);
      fd.set("discountType", draft.discountType);
      fd.set("discountValue", draft.value);
      fd.set("minSubtotal", draft.minSubtotal || "0");
      if (draft.maxUses) fd.set("maxUses", draft.maxUses);
      if (draft.expiresAt) fd.set("expiresAt", draft.expiresAt);
      fd.set("active", draft.active ? "on" : "");

      const result = await saveCoupon(draft.id, fd);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (result.error && !result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success(draft.id ? "Купонът е обновен." : "Купонът е създаден.");
      setDraft(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPendingId(id);
    try {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Грешка.");
      else router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Промо кодове</h1>
          <p className="mt-1 text-sm text-ink-500">
            Кодове за отстъпка, които клиентите въвеждат при поръчка.
          </p>
        </div>
        <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
          <Icon name="plus" size={15} className="-ml-0.5" />
          Нов код
        </Button>
      </div>

      {coupons.length === 0 ? (
        <Card className="py-10 text-center text-sm text-ink-500">
          Още нямаш промо кодове. Създай първия — клиентите го въвеждат на страницата за поръчка.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {coupons.map((c) => {
            const expired = c.expiresAt && c.expiresAt.getTime() < now;
            const exhausted = c.maxUses !== null && c.usedCount >= c.maxUses;
            return (
              <Card key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-mono text-base font-bold text-ink-900">{c.code}</span>
                <Badge tone="neutral">{discountLabel(c)}</Badge>
                {c.minSubtotalCents > 0 && (
                  <span className="text-sm text-ink-500">над {formatPrice(c.minSubtotalCents)}</span>
                )}
                <span className="text-sm text-ink-500">
                  {c.usedCount}
                  {c.maxUses !== null ? `/${c.maxUses}` : ""} употреби
                </span>
                {c.expiresAt && (
                  <span className="text-sm text-ink-500">
                    до {c.expiresAt.toLocaleDateString("bg-BG")}
                  </span>
                )}
                {!c.active && <Badge tone="neutral">Изключен</Badge>}
                {expired && <Badge tone="warning">Изтекъл</Badge>}
                {exhausted && <Badge tone="warning">Изчерпан</Badge>}

                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={pendingId === c.id}
                    onClick={() => run(c.id, () => toggleCoupon(c.id, !c.active))}
                  >
                    {c.active ? "Изключи" : "Включи"}
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Редактирай" onClick={() => setDraft(toDraft(c))}>
                    <Icon name="pencil" size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Изтрий"
                    onClick={() => setToDelete({ id: c.id, code: c.code })}
                  >
                    <Icon name="trash" size={16} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Drawer
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Редактирай код" : "Нов промо код"}
        footer={
          <Button onClick={save} loading={saving}>
            Запази
          </Button>
        }
      >
        {draft && (
          <div className="flex flex-col gap-4">
            <Input
              label="Код"
              value={draft.code}
              onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              placeholder="ЛЯТО10"
              error={errors.code}
              hint="Клиентът го въвежда при поръчка (главни букви, цифри, тире)."
            />
            <Select
              label="Тип отстъпка"
              options={[
                { value: "percent", label: "Процент (%)" },
                { value: "fixed", label: "Фиксирана сума (€)" },
              ]}
              value={draft.discountType}
              onChange={(e) => set({ discountType: e.target.value as "percent" | "fixed" })}
            />
            <Input
              label={draft.discountType === "percent" ? "Процент отстъпка" : "Сума отстъпка (€)"}
              type="number"
              inputMode="decimal"
              value={draft.value}
              onChange={(e) => set({ value: e.target.value })}
              placeholder={draft.discountType === "percent" ? "10" : "5.00"}
              error={errors.discountValue}
            />
            <Input
              label="Минимална сума на поръчката (€)"
              type="number"
              inputMode="decimal"
              value={draft.minSubtotal}
              onChange={(e) => set({ minSubtotal: e.target.value })}
              placeholder="Празно = без минимум"
            />
            <Input
              label="Максимум употреби"
              type="number"
              inputMode="numeric"
              value={draft.maxUses}
              onChange={(e) => set({ maxUses: e.target.value })}
              placeholder="Празно = без лимит"
            />
            <Input
              label="Валиден до"
              type="date"
              value={draft.expiresAt}
              onChange={(e) => set({ expiresAt: e.target.value })}
              hint="Празно = безсрочен"
            />
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={toDelete !== null}
        title="Изтрий промо кода?"
        message={toDelete ? `Кодът „${toDelete.code}“ ще спре да работи.` : ""}
        confirmLabel="Изтрий"
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await run(toDelete.id, () => deleteCoupon(toDelete.id));
          setToDelete(null);
        }}
      />
    </div>
  );
}
