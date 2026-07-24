import { Badge, Card, Table, TBody, TCell, TH, THead, TRow } from "@/components/ui";
import type { PlatformOrderRow } from "@/db/queries/admin";
import { formatPrice } from "@/lib/money";

const dateFmt = new Intl.DateTimeFormat("bg-BG", { dateStyle: "short", timeStyle: "short" });

const STATUS_META: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "brand" }> = {
  new: { label: "Нова", tone: "brand" },
  confirmed: { label: "Потвърдена", tone: "neutral" },
  shipped: { label: "Изпратена", tone: "neutral" },
  completed: { label: "Завършена", tone: "success" },
  cancelled: { label: "Отказана", tone: "danger" },
  pending_payment: { label: "Чака плащане", tone: "warning" },
};

const PAYMENT_LABEL: Record<string, string> = {
  cod: "Наложен платеж",
  bank_transfer: "Банков превод",
  on_site: "На място",
  online_card: "Карта (ePay)",
};

/** Супер-админ таб „Поръчки" — read-only списък поръчки през цялата платформа. */
export function AdminOrdersTable({ orders }: { orders: PlatformOrderRow[] }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-bold text-ink-900">Последни поръчки ({orders.length})</h2>
      {orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-500">Още няма поръчки.</p>
      ) : (
        <Table>
          <THead>
            <TH>№</TH>
            <TH>Магазин</TH>
            <TH>Сума</TH>
            <TH>Статус</TH>
            <TH>Плащане</TH>
            <TH>Дата</TH>
          </THead>
          <TBody>
            {orders.map((o) => {
              const meta = STATUS_META[o.status] ?? STATUS_META.new!;
              return (
                <TRow key={o.id}>
                  <TCell className="tabular-nums font-medium text-ink-900">#{o.orderNumber}</TCell>
                  <TCell>{o.shopName}</TCell>
                  <TCell className="tabular-nums">{formatPrice(o.totalCents)}</TCell>
                  <TCell>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </TCell>
                  <TCell className="text-ink-500">{PAYMENT_LABEL[o.paymentType] ?? o.paymentType}</TCell>
                  <TCell className="text-ink-500">{dateFmt.format(o.createdAt)}</TCell>
                </TRow>
              );
            })}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
