import type { NamedMetric } from "@/db/queries/analytics-breakdowns";
import { formatPrice } from "@/lib/money";

/** Малка hairline таблица за списък NamedMetric (име · бройки · приходи). */
export function BreakdownTable({ rows, emptyText }: { rows: NamedMetric[]; emptyText: string }) {
  if (rows.length === 0) {
    return <p className="px-1 py-3 text-sm text-ink-500">{emptyText}</p>;
  }
  return (
    <ul className="divide-y divide-surface-100">
      {rows.map((r) => (
        <li key={r.name} className="flex items-center gap-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-ink-900">{r.name}</span>
          <span className="tabular-nums text-ink-500">{r.orderCount} бр.</span>
          <span className="w-24 text-right font-bold tabular-nums text-ink-900">
            {formatPrice(r.revenueCents)}
          </span>
        </li>
      ))}
    </ul>
  );
}
