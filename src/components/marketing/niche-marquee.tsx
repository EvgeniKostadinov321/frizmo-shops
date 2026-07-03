const NICHES = ["Храни", "Мода", "Ръчна изработка", "Козметика", "Дом и градина", "Занаяти"];

/**
 * Безкраен бавен marquee — социално доказателство преди да имаме лога на
 * клиенти (спец §14). Дублира списъка веднъж за безшевен loop; пауза на hover.
 */
export function NicheMarquee() {
  return (
    <div
      aria-hidden
      className="group overflow-hidden border-y border-surface-200 bg-surface-0/60 py-4"
    >
      <div className="flex w-max animate-marquee gap-12 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[...NICHES, ...NICHES].map((niche, i) => (
          <span
            key={`${niche}-${i}`}
            className="shrink-0 text-sm font-bold uppercase tracking-[0.2em] text-ink-500"
          >
            {niche}
          </span>
        ))}
      </div>
    </div>
  );
}
