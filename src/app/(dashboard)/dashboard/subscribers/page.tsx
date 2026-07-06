import { SubscribersExport } from "@/components/dashboard/subscribers-export";
import { Card, EmptyState, Table, TBody, TCell, TH, THead, TRow } from "@/components/ui";
import { getConfirmedSubscribers } from "@/db/queries/subscribers";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Абонати — Frizmo Shops" };

const dateFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function SubscribersPage() {
  const { shop } = await requireShop();
  const rows = await getConfirmedSubscribers(shop.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Абонати за бюлетина</h1>
          <p className="mt-1 text-sm text-ink-500">
            {rows.length === 1 ? "1 потвърден абонат" : `${rows.length} потвърдени абонати`}
          </p>
        </div>
        {rows.length > 0 && <SubscribersExport />}
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="megaphone"
            title="Още няма абонати"
            description="Добави секция „Бюлетин“ на сайта си (таб Уебсайт → Секции), за да събираш имейли. Абонатите се появяват тук, след като потвърдят по имейл."
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <THead>
              <TRow>
                <TH>Имейл</TH>
                <TH>Потвърден на</TH>
              </TRow>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TRow key={r.email}>
                  <TCell className="font-medium text-ink-900">{r.email}</TCell>
                  <TCell className="text-ink-500">
                    {r.confirmedAt ? dateFormat.format(r.confirmedAt) : "—"}
                  </TCell>
                </TRow>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
