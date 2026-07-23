"use client";

import { Card, Icon } from "@/components/ui";
import { formatPrice } from "@/lib/money";
import { CardSetupForm } from "./card-setup-form";
import { SavedCard } from "./saved-card";
import type { FeeInvoiceView } from "@/actions/billing";
import type { SavedCard as SavedCardData } from "@/lib/stripe";

interface BillingPanelProps {
  needsCard: boolean;
  overdue: boolean;
  card: SavedCardData | null;
  invoices: FeeInvoiceView[];
}

/** Статус на фактура → етикет + цветови тон. */
const INVOICE_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Изготвя се", tone: "text-ink-500" },
  issued: { label: "За плащане", tone: "text-warning-600" },
  paid: { label: "Платена", tone: "text-success-600" },
  uncollectible: { label: "Несъбираема", tone: "text-danger-700" },
};

/** Форматира периода (начало на месец) като „юли 2026". */
function periodLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("bg-BG", { month: "long", year: "numeric" });
}

/**
 * Билинг панел (таксов модел): визуализира запазената карта / card-gate формата,
 * предупреждение при просрочена фактура, и списък с месечните такси.
 */
export function BillingPanel({ needsCard, overdue, card, invoices }: BillingPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-bold text-ink-900">Такси и плащане</h2>
          <p className="mt-1 text-sm text-ink-500">
            Магазинът е безплатен. Взимаме 5% при реална продажба (мин. 0,30 €, макс. 50 € на
            поръчка) — таксите се обобщават в месечна фактура и се теглят автоматично.
          </p>
        </div>

        {overdue && (
          <div className="flex items-start gap-2.5 rounded-control border border-danger-600/30 bg-danger-600/5 p-3 text-sm text-danger-700">
            <Icon name="wallet" size={16} className="mt-0.5 shrink-0" />
            <span>
              Има неплатена фактура. Магазинът временно не приема нови поръчки, докато таксата
              не бъде уредена.
            </span>
          </div>
        )}

        {/* Card-gate: няма карта, но има таксуема продажба → форма за запазване. */}
        {needsCard && <CardSetupForm />}

        {/* Запазена карта → визуализация + смяна. */}
        {!needsCard && card && <SavedCard card={card} />}

        {/* Няма нужда от карта още (без завършена продажба) и няма запазена. */}
        {!needsCard && !card && !overdue && (
          <p className="flex items-center gap-2 text-sm text-success-600">
            <Icon name="check" size={16} className="shrink-0" />
            Всичко е наред. Карта ще се поиска след първата ти продажба.
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 className="font-bold text-ink-900">Месечни такси</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-ink-500">Още няма издадени фактури.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-200">
            {invoices.map((inv) => {
              const status = INVOICE_STATUS[inv.status] ?? { label: inv.status, tone: "text-ink-500" };
              return (
                <li key={inv.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium text-ink-900">{periodLabel(inv.periodStart)}</span>
                  <span className="flex items-center gap-4">
                    <span className="font-semibold text-ink-900 tabular-nums">
                      {formatPrice(inv.amountDueCents)}
                    </span>
                    <span className={`text-xs font-medium ${status.tone}`}>{status.label}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
