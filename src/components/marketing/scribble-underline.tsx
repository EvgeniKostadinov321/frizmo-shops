"use client";

import { m } from "motion/react";
import { DUR_SLOW, EASE_OUT } from "@/lib/motion";

/**
 * Маркерен щрих под акцентната дума в hero H1 — една уверена, леко извита
 * „четка" (запълнена лента с изтъняващи краища), която се „изтегля" отляво
 * надясно при зареждане (ember-ът е брандовият момент на hero-то, спец §3).
 * Reduced-motion: MotionConfig изключва transform анимацията → щрихът стои.
 */
export function ScribbleUnderline() {
  return (
    <m.svg
      aria-hidden
      viewBox="0 0 120 12"
      preserveAspectRatio="none"
      className="absolute inset-x-0 -bottom-2 -z-10 h-3 w-full origin-left text-ember-500"
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 0.9 }}
      transition={{ delay: 0.45, duration: DUR_SLOW, ease: EASE_OUT }}
    >
      {/* Тапериран „марker swoosh": дебел в средата, тънък в двата края */}
      <path
        d="M4 8.6
           C 28 4.6, 74 3.4, 116 5.6
           C 117.5 5.7, 117.5 6.9, 116 7.1
           C 76 5.9, 32 7.6, 5.5 11.2
           C 3.6 11.5, 2.6 9.1, 4 8.6 Z"
        fill="currentColor"
      />
    </m.svg>
  );
}
