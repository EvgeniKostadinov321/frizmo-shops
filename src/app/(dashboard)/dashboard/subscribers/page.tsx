import { CampaignComposer } from "@/components/dashboard/campaign-composer";
import { GrowthSettingsForm } from "@/components/dashboard/growth-settings-form";
import { SubscribersExport } from "@/components/dashboard/subscribers-export";
import {
  Card,
  EmptyState,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
  Tabs,
  TabPanel,
} from "@/components/ui";
import { getCampaigns, getConfirmedSubscribers } from "@/db/queries/subscribers";
import { getShopReferrals } from "@/db/queries/referrals";
import { requireShop } from "@/lib/auth";
import { count, NOUNS } from "@/lib/plural";

export const metadata = { title: "Абонати — Frizmo Shops" };

const dateFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function SubscribersPage() {
  const { shop } = await requireShop();
  const [rows, campaignHistory, referralsList] = await Promise.all([
    getConfirmedSubscribers(shop.id),
    getCampaigns(shop.id),
    getShopReferrals(shop.id),
  ]);

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

      <Tabs
        ariaLabel="Абонати"
        tabs={[
          { key: "subscribers", label: "Абонати" },
          { key: "campaigns", label: "Кампании" },
          { key: "growth", label: "Купони за растеж" },
        ]}
      >
        <TabPanel tabKey="subscribers">
          <div className="flex flex-col gap-4">
            {referralsList.length > 0 && (
              <Card>
                <div className="border-b border-surface-200 px-5 py-4">
                  <h2 className="font-display text-lg font-bold text-ink-900">Реферали</h2>
                  <p className="mt-0.5 text-sm text-ink-500">
                    Абонати с личен реферален код и брой доведени поръчки.
                  </p>
                </div>
                <Table>
                  <THead>
                    <TH>Абонат</TH>
                    <TH>Код</TH>
                    <TH>Доведени</TH>
                  </THead>
                  <TBody>
                    {referralsList.map((r) => (
                      <TRow key={r.code}>
                        <TCell className="font-medium text-ink-900">{r.email}</TCell>
                        <TCell className="font-mono text-ink-700">{r.code}</TCell>
                        <TCell className="tabular-nums text-ink-500">
                          {count(r.referredCount, NOUNS.order)}
                        </TCell>
                      </TRow>
                    ))}
                  </TBody>
                </Table>
              </Card>
            )}
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
                    <TH>Имейл</TH>
                    <TH>Потвърден на</TH>
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
        </TabPanel>

        <TabPanel tabKey="campaigns">
          <div className="flex flex-col gap-4">
            {rows.length > 0 ? (
              <CampaignComposer recipientCount={rows.length} />
            ) : (
              <Card>
                <EmptyState
                  icon="megaphone"
                  title="Няма на кого да пратиш"
                  description="Кампаниите се пращат до потвърдените абонати. Първо събери абонати през секция „Бюлетин“ на сайта."
                />
              </Card>
            )}
            {campaignHistory.length > 0 && (
              <Card>
                <div className="border-b border-surface-200 px-5 py-4">
                  <h2 className="font-display text-lg font-bold text-ink-900">Изпратени кампании</h2>
                </div>
                <ul className="divide-y divide-surface-100">
                  {campaignHistory.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                        {c.subject}
                      </span>
                      <span className="text-sm text-ink-500">{dateFormat.format(c.createdAt)}</span>
                      <span className="text-sm tabular-nums text-ink-500">
                        {c.recipientCount} {c.recipientCount === 1 ? "получател" : "получатели"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </TabPanel>

        <TabPanel tabKey="growth">
          <GrowthSettingsForm shop={shop} />
        </TabPanel>
      </Tabs>
    </div>
  );
}
