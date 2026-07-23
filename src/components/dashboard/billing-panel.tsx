"use client";

import { Card } from "@/components/ui";
import { formatPrice } from "@/lib/money";
import { CardSetupForm } from "./card-setup-form";
import type { FeeInvoiceView } from "@/actions/billing";

interface BillingPanelProps {
  needsCard: boolean;
  overdue: boolean;
  invoices: FeeInvoiceView[];
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Изготвя се",
  issued: "За плащане",
  paid: "Платена",
  uncollectible: "Несъбираема",
};

/** Форматира периода (начало на месец) като „юли 2026". */
function periodLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("bg-BG", { month: "long", year: "numeric" });
}

/**
 * Билинг панел (таксов модел): показва card-gate формата при нужда, предупреждение
 * при просрочена фактура, и списък с месечните такси. Няма абонамент/планове.
 */
export function BillingPanel({ needsCard, overdue, invoices }: BillingPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="font-bold text-ink-900">Такси и плащане</h2>
          <p className="mt-1 text-sm text-ink-500">
            Магазинът е безплатен. Взимаме 5% при реална продажба (мин. 0,30 €, макс. 50 € на
            поръчка) — таксите се обобщават в месечна фактура.
          </p>
        </div>

        {overdue && (
          <div className="rounded-control border border-danger-600/30 bg-danger-600/5 p-3 text-sm text-danger-700">
            Има неплатена фактура. Магазинът временно не приема нови поръчки, докато таксата не
            бъде уредена.
          </div>
        )}

        {needsCard && <CardSetupForm />}

        {!needsCard && !overdue && (
          <p className="text-sm text-success-600">
            Всичко е наред — плащането на таксите е настроено.
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 className="font-bold text-ink-900">Месечни такси</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-ink-500">Още няма издадени фактури.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-200">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink-700">{periodLabel(inv.periodStart)}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium text-ink-900 tabular-nums">
                    {formatPrice(inv.amountDueCents)}
                  </span>
                  <span className="text-ink-500">{INVOICE_STATUS_LABEL[inv.status] ?? inv.status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
