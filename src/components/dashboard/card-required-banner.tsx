import Link from "next/link";
import { Icon } from "@/components/ui";

/**
 * Промотен банер на таблото, когато магазинът има завършена продажба, но няма
 * запазена карта → НЕ приема нови поръчки. Води директно към таб „Такси".
 * Показва се само при needsCard (иначе layout-ът не го рендерира).
 */
export function CardRequiredBanner() {
  return (
    <Link
      href="/dashboard/billing"
      className="flex items-start gap-3 rounded-card border border-danger-600/30 bg-danger-600/5 p-4 transition-colors hover:bg-danger-600/10"
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-600/15 text-danger-700">
        <Icon name="wallet" size={18} />
      </span>
      <div className="flex-1">
        <p className="font-bold text-ink-900">Магазинът не приема нови поръчки</p>
        <p className="mt-0.5 text-sm text-ink-700">
          Имаш първа продажба. Запази карта, за да продължиш да продаваш — таксата се тегли
          автоматично от нея.
        </p>
        <span className="mt-2 inline-block text-sm font-semibold text-danger-700">
          Добави карта →
        </span>
      </div>
    </Link>
  );
}
