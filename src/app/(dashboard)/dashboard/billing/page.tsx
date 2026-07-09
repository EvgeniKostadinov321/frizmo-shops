import { getBillingStatus } from "@/actions/billing";
import { BillingPanel } from "@/components/dashboard/billing-panel";

export const metadata = { title: "Абонамент — Frizmo Shops" };

export default async function BillingPage() {
  const res = await getBillingStatus();
  const data = res.ok ? res.data : { status: "trial", plan: "pro", currentPeriodEnd: null };

  return (
    <div className="mx-auto w-full max-w-xl">
      <BillingPanel status={data.status} plan={data.plan} currentPeriodEnd={data.currentPeriodEnd} />
    </div>
  );
}
