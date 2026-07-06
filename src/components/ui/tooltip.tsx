/**
 * Лек CSS-only tooltip: балонът се показва при hover/focus върху обвития
 * елемент (с кратко забавяне, за да не мига при преминаване). Допълва видимия
 * етикет — никога не го замества (на тъч устройства просто не се показва).
 */
interface TooltipProps {
  /** Какво прави елементът — кратко изречение. */
  label: string;
  /** Хоризонтално подравняване на балона (end = за елементи до десния ръб). */
  align?: "center" | "end";
  /** От коя страна се показва балонът. */
  side?: "top" | "bottom";
  children: React.ReactNode;
  className?: string;
}

export function Tooltip({
  label,
  align = "center",
  side = "bottom",
  children,
  className = "",
}: TooltipProps) {
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        aria-hidden
        className={`pointer-events-none absolute z-50 w-max max-w-60 rounded-control bg-ink-900 px-2.5 py-1.5 text-xs font-medium leading-snug text-surface-50 opacity-0 shadow-float transition-opacity duration-150 group-hover/tip:opacity-100 group-hover/tip:delay-300 group-focus-within/tip:opacity-100 group-focus-within/tip:delay-300 ${
          side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5"
        } ${align === "center" ? "left-1/2 -translate-x-1/2" : "right-0"}`}
      >
        {label}
      </span>
    </span>
  );
}
