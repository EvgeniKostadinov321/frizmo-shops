import type { DailyRevenue } from "@/db/queries/analytics";
import { formatPrice } from "@/lib/money";

const dateFormat = new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "short" });

/**
 * S5: приходи по дни — чист SVG bar chart (без външна библиотека).
 * Всяка колона има <title> (дата + сума) за достъпност/hover.
 */
export function RevenueChart({ daily }: { daily: DailyRevenue[] }) {
  const max = Math.max(...daily.map((d) => d.revenueCents), 1);
  const width = 100; /* проценти — responsive през viewBox */
  const height = 40;
  const gap = daily.length > 45 ? 0.15 : 0.3;
  const barWidth = width / daily.length - gap;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Приходи по дни"
      className="h-40 w-full"
    >
      {daily.map((d, i) => {
        const barHeight = d.revenueCents > 0 ? Math.max((d.revenueCents / max) * (height - 2), 0.6) : 0.25;
        return (
          <rect
            key={d.day}
            x={i * (width / daily.length) + gap / 2}
            y={height - barHeight}
            width={Math.max(barWidth, 0.4)}
            height={barHeight}
            rx={0.3}
            className={d.revenueCents > 0 ? "fill-brand-600" : "fill-surface-200"}
          >
            <title>
              {`${dateFormat.format(new Date(d.day))}: ${formatPrice(d.revenueCents)} (${d.orderCount} ${d.orderCount === 1 ? "поръчка" : "поръчки"})`}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}
