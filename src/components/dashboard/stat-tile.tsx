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
    /* Мобилно: икона отгоре, текст отдолу (ползва цялата ширина — дълги суми/
       етикети се събират). Десктоп (sm+): икона отляво, текст отдясно. */
    <div className="flex h-full flex-col gap-2 rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors group-hover:border-brand-500 sm:flex-row sm:items-center sm:gap-4">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-2xl sm:size-11 ${
          accent ? "bg-brand-500 text-surface-0" : "bg-surface-100 text-ink-700"
        }`}
      >
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-bold tabular-nums text-ink-900 sm:text-2xl">
          {value}
        </p>
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
