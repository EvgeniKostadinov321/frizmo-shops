import { Icon, type IconName } from "@/components/ui";

/** Коя мини-визуализация да се покаже в горната част на картата. */
export type PainVisual = "chats" | "feed" | "search";

type PainCardProps = {
  icon: IconName;
  title: string;
  text: string;
  visual: PainVisual;
};

/** Хаос от чат балончета — поръчки, разпръснати из съобщенията. */
function ChatsVisual() {
  return (
    <div aria-hidden className="flex flex-col gap-1.5">
      <span className="w-3/5 rounded-lg rounded-bl-sm bg-surface-100 px-2.5 py-1.5 text-[10px] text-ink-500">
        Имате ли го в синьо?
      </span>
      <span className="ml-auto w-1/2 rounded-lg rounded-br-sm bg-brand-100 px-2.5 py-1.5 text-right text-[10px] text-brand-700">
        Да, 25 лв 🙂
      </span>
      <span className="w-2/3 rounded-lg rounded-bl-sm bg-surface-100 px-2.5 py-1.5 text-[10px] text-ink-500">
        А доставка до Варна?
      </span>
    </div>
  );
}

/** Продукт, който потъва в безличен feed — избледнява надолу. */
function FeedVisual() {
  return (
    <div aria-hidden className="flex flex-col gap-1.5">
      {[1, 0.55, 0.25].map((opacity, i) => (
        <span
          key={i}
          style={{ opacity }}
          className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-0 p-1.5"
        >
          <span className="size-6 shrink-0 rounded-md bg-surface-100" />
          <span className="flex flex-1 flex-col gap-1">
            <span className="h-1.5 w-2/3 rounded-full bg-surface-200" />
            <span className="h-1.5 w-1/3 rounded-full bg-surface-100" />
          </span>
        </span>
      ))}
    </div>
  );
}

/** Празен резултат от търсене — теб те няма там. */
function SearchVisual() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <span className="flex items-center gap-2 rounded-full border border-surface-200 bg-surface-0 px-3 py-1.5">
        <Icon name="search" size={12} className="text-ink-500" />
        <span className="text-[10px] text-ink-500">домашно сирене пловдив</span>
      </span>
      <span className="flex items-center gap-2 rounded-lg border border-dashed border-surface-300 bg-surface-0/50 px-3 py-2">
        <span className="size-1.5 rounded-full bg-surface-300" />
        <span className="text-[10px] italic text-ink-500">твоят магазин липсва тук</span>
      </span>
    </div>
  );
}

const VISUALS: Record<PainVisual, () => React.ReactElement> = {
  chats: ChatsVisual,
  feed: FeedVisual,
  search: SearchVisual,
};

/**
 * Карта за секцията „Болката" — истинска карта (фон, борд, сянка, hover),
 * с едра икона и мини CSS визуализация, която прави болката осезаема.
 */
export function PainCard({ icon, title, text, visual }: PainCardProps) {
  const Visual = VISUALS[visual];
  return (
    <div className="group flex h-full flex-col gap-5 rounded-card border border-surface-200 bg-surface-0 p-6 shadow-card transition-all hover:-translate-y-1 hover:border-surface-300 hover:shadow-float">
      <div className="flex h-32 flex-col justify-center rounded-xl bg-surface-50 p-4">
        <Visual />
      </div>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm transition-transform group-hover:scale-105">
        <Icon name={icon} size={22} />
      </span>
      <div className="flex flex-1 flex-col gap-2">
        <h3 className="text-lg font-bold text-ink-900">{title}</h3>
        <p className="text-[15px] leading-relaxed text-ink-700">{text}</p>
      </div>
    </div>
  );
}
