"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import type { SavedCard as SavedCardData } from "@/lib/stripe";
import { CardSetupForm } from "./card-setup-form";
import { removeCard } from "@/actions/card-setup";

/** BG етикет на brand-а (Stripe дава латиница). */
const BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

function brandLabel(brand: string): string {
  return BRAND_LABEL[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

/**
 * Визуализация на запазената карта (brand • •••• last4 • изтичане) + „Смени картата".
 * При смяна разгъва CardSetupForm инлайн (не нова страница).
 */
export function SavedCard({ card }: { card: SavedCardData }) {
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const exp = `${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`;

  async function remove() {
    setRemoving(true);
    const res = await removeCard();
    if (!res.ok) {
      toast.error(res.error);
      setRemoving(false);
      return;
    }
    toast.success("Картата е премахната.");
    router.refresh();
  }

  if (changing) {
    return (
      <div className="flex flex-col gap-3">
        <CardSetupForm />
        <button
          type="button"
          onClick={() => setChanging(false)}
          className="self-start text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
        >
          Откажи
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-surface-200 bg-surface-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-control bg-ink-900 text-surface-0">
            <Icon name="wallet" size={20} />
          </span>
          <div>
            <p className="font-semibold text-ink-900">
              {brandLabel(card.brand)} <span className="text-ink-400">••••</span>{" "}
              <span className="tabular-nums">{card.last4}</span>
            </p>
            <p className="text-xs text-ink-500">Изтича {exp}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setChanging(true)}>
            Смени
          </Button>
          <Button variant="ghost" onClick={() => setConfirmRemove(true)}>
            Премахни
          </Button>
        </div>
      </div>

      {confirmRemove && (
        <div className="flex flex-col gap-2.5 rounded-control border border-danger-600/30 bg-danger-600/5 p-3">
          <p className="text-sm text-danger-700">
            Ако премахнеш картата и имаш продажби, магазинът ще спре да приема нови поръчки,
            докато не запазиш нова карта. Сигурен ли си?
          </p>
          <div className="flex gap-2">
            <Button variant="danger" loading={removing} onClick={remove}>
              Да, премахни
            </Button>
            <Button variant="secondary" onClick={() => setConfirmRemove(false)} disabled={removing}>
              Откажи
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
