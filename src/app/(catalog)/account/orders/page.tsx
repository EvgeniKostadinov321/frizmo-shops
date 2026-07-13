import type { Metadata } from "next";
import Link from "next/link";
import { getBuyerOrdersGlobal } from "@/db/queries/buyer-global";
import { requireBuyer } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Моите поръчки — Frizmo Shops", robots: { index: false } };

const STATUS_LABELS: Record<string, string> = {
  new: "Приета",
  confirmed: "Потвърдена",
  shipped: "Изпратена",
  completed: "Завършена",
  cancelled: "Отказана",
  return_requested: "Заявено връщане",
  returned: "Върната",
};
const dateFmt = new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium" });

export default async function AccountOrdersPage() {
  const { profile } = await requireBuyer();
  const orders = await getBuyerOrdersGlobal(profile.id);
  if (orders.length === 0) {
    return (
      <div className="rounded-card border border-surface-200 bg-surface-0 p-8 text-center">
        <p className="text-sm text-ink-500">Още нямаш поръчки.</p>
        <Link
          href="/shops"
          className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline"
        >
          Разгледай магазините
        </Link>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/s/${o.shopSlug}/order/${o.id}?t=${o.publicToken}`}
            className="flex items-center justify-between gap-3 rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors hover:border-brand-600"
          >
            <div className="min-w-0">
              <p className="font-medium text-ink-900">
                Поръчка №{String(o.orderNumber).padStart(4, "0")}
              </p>
              <p className="mt-0.5 text-sm text-ink-500">
                {o.shopName} · {dateFmt.format(o.createdAt)} · {STATUS_LABELS[o.status] ?? "Приета"}
              </p>
            </div>
            <span className="shrink-0 font-medium text-ink-900">{formatPrice(o.totalCents)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
