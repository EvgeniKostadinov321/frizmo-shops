import { Icon } from "@/components/ui";

/**
 * S1: статичен ред звезди (1–5). Цветът идва от currentColor на родителя;
 * запълнените са fill-current, празните — само контур с приглушен цвят.
 */
export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Оценка ${rating.toFixed(1)} от 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          size={size}
          className={n <= rounded ? "fill-current" : "opacity-30"}
        />
      ))}
    </span>
  );
}
