/**
 * Motion токени — огледало на CSS custom properties в tokens.css.
 * Единствен източник за durations/easings/spring конфигурации в Motion компонентите.
 */
export const DUR_FAST = 0.15;
export const DUR_BASE = 0.25;
export const DUR_SLOW = 0.4;

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

export const SPRING_SNAPPY = { type: "spring", stiffness: 380, damping: 30 } as const;

/** Section reveal: opacity 0→1, y 24→0 — стандартният landing/storefront патърн. */
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR_BASE, ease: EASE_OUT } },
};

/** Родителски вариант за stagger grid-ове (продуктови карти, feature карти). */
export function staggerContainer(staggerChildren = 0.06, delayChildren = 0) {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren, delayChildren },
    },
  };
}
