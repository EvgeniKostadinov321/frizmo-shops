import { AdminInvoiceRetry } from "@/components/dashboard/admin-invoice-actions";
import { Badge, Card, Table, TBody, TCell, TH, THead, TRow } from "@/components/ui";
import type { FeeInvoiceRow, FeeLedgerRow, MonetizationStats } from "@/db/queries/admin";
import { formatPrice } from "@/lib/money";

const dateFmt = new Intl.DateTimeFormat("bg-BG", { dateStyle: "short" });
const periodFmt = new Intl.DateTimeFormat("bg-BG", { month: "long", year: "numeric" });

/** Статус на месечна фактура → етикет + тон. */
const INV_STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  draft: { label: "Чернова", tone: "neutral" },
  issued: { label: "Издадена", tone: "warning" },
  paid: { label: "Платена", tone: "success" },
  uncollectible: { label: "Несъбираема", tone: "danger" },
};

/** Супер-админ таб „Монетизация" — обобщение на таксите + месечни фактури + ledger. */
export function AdminMonetization({
  stats,
  invoices,
  ledger,
}: {
  stats: MonetizationStats;
  invoices: FeeInvoiceRow[];
  ledger: FeeLedgerRow[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-ink-500">Начислени такси</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{formatPrice(stats.totalChargedCents)}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-500">Кредити (връщания)</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{formatPrice(stats.totalCreditsCents)}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-500">Неплатени фактури</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{stats.unpaidCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-500">Дължимо (неплатено)</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{formatPrice(stats.unpaidCents)}</p>
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="font-bold text-ink-900">Месечни фактури</h2>
        {invoices.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">Още няма фактури.</p>
        ) : (
          <Table>
            <THead>
              <TRow>
                <TH>Магазин</TH>
                <TH>Период</TH>
                <TH>Дължимо</TH>
                <TH>Статус</TH>
                <TH>inv.bg</TH>
                <TH aria-label="Действия" />
              </TRow>
            </THead>
            <TBody>
              {invoices.map((inv) => {
                const meta = INV_STATUS[inv.status] ?? INV_STATUS.draft!;
                return (
                  <TRow key={inv.id}>
                    <TCell className="font-medium text-ink-900">{inv.shopName}</TCell>
                    <TCell>{periodFmt.format(inv.periodStart)}</TCell>
                    <TCell className="tabular-nums">{formatPrice(inv.amountDueCents)}</TCell>
                    <TCell>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </TCell>
                    <TCell>
                      {inv.invBgStatus === "issued" ? (
                        <Badge tone="success">Издадена</Badge>
                      ) : inv.invBgStatus === "failed" ? (
                        <Badge tone="danger">Провал</Badge>
                      ) : inv.invBgStatus === "skipped" ? (
                        <Badge tone="warning">Няма данни</Badge>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                    </TCell>
                    <TCell>
                      {(inv.invBgStatus === "failed" || inv.invBgStatus === "skipped") && (
                        <AdminInvoiceRetry feeInvoiceId={inv.id} />
                      )}
                    </TCell>
                  </TRow>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-bold text-ink-900">Последни начисления</h2>
        {ledger.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">Още няма начисления.</p>
        ) : (
          <Table>
            <THead>
              <TRow>
                <TH>Магазин</TH>
                <TH>Тип</TH>
                <TH>Сума</TH>
                <TH>База</TH>
                <TH>Дата</TH>
              </TRow>
            </THead>
            <TBody>
              {ledger.map((e) => (
                <TRow key={e.id}>
                  <TCell className="font-medium text-ink-900">{e.shopName}</TCell>
                  <TCell>
                    <Badge tone={e.type === "charge" ? "brand" : "warning"}>
                      {e.type === "charge" ? "Такса" : "Кредит"}
                    </Badge>
                  </TCell>
                  <TCell className="tabular-nums">{formatPrice(e.amountCents)}</TCell>
                  <TCell className="tabular-nums text-ink-500">{formatPrice(e.baseCents)}</TCell>
                  <TCell className="text-ink-500">{dateFmt.format(e.occurredAt)}</TCell>
                </TRow>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
