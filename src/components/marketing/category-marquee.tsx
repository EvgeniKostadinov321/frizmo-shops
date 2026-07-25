/**
 * Категориен marquee под hero-то — „улицата на пазара": какво се продава с
 * Frizmo Shops. Безкраен ход чрез .sf-marquee (дублирано съдържание, -50%);
 * reduced-motion → статичен ред (глобалното правило в globals.css).
 */
const CATEGORIES = [
  "Керамика",
  "Ръчна изработка",
  "Мед и деликатеси",
  "Козметика",
  "Бижута",
  "Дрехи",
  "Дом и декор",
  "Храни от фермата",
  "Изкуство",
  "Аксесоари",
];

function Row({ hidden = false }: { hidden?: boolean }) {
  return (
    <span aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {CATEGORIES.map((label) => (
        <span key={label} className="flex items-center">
          <span className="whitespace-nowrap px-5 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
            {label}
          </span>
          <span aria-hidden className="size-1 rounded-full bg-ember-500/60" />
        </span>
      ))}
    </span>
  );
}

export function CategoryMarquee() {
  return (
    <div className="overflow-hidden border-y border-surface-200 bg-surface-0/60 py-3.5">
      <div className="sf-marquee flex w-max">
        <Row />
        <Row hidden />
      </div>
    </div>
  );
}
