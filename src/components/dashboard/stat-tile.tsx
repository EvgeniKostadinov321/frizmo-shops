import Link from "next/link";
import { Icon, type IconName } from "@/components/ui";

interface StatTileProps {
  label: string;
  value: string | number;
  icon: IconName;
  href?: string;
  /** Акцентен тон за иконата (напр. нови поръчки). */
  accent?: boolean;
}

/**
 * Компактна KPI плочка за таблото: икона в кръгче + стойност + етикет. Кликаема,
 * ако е подадено `href`. Само токени → light + dark.
 */
export function StatTile({ label, value, icon, href, accent = false }: StatTileProps) {
  const body = (
    <div className="flex h-full items-center gap-4 rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors group-hover:border-brand-500">
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
          accent ? "bg-brand-500 text-surface-0" : "bg-surface-100 text-ink-700"
        }`}
      >
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-ink-900">{value}</p>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="group block">
      {body}
    </Link>
  ) : (
    <div className="group">{body}</div>
  );
}
