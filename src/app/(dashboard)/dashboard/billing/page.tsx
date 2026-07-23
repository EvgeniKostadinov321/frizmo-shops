import { getBillingStatus } from "@/actions/billing";
import { BillingPanel } from "@/components/dashboard/billing-panel";

export const metadata = { title: "Такси — Frizmo Shops" };

export default async function BillingPage() {
  const res = await getBillingStatus();
  const data = res.ok
    ? res.data
    : { needsCard: false, overdue: false, card: null, invoices: [] };

  return (
    <div className="mx-auto w-full max-w-xl">
      <BillingPanel
        needsCard={data.needsCard}
        overdue={data.overdue}
        card={data.card}
        invoices={data.invoices}
      />
    </div>
  );
}
