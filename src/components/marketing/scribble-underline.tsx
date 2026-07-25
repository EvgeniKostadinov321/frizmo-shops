"use client";

import { m } from "motion/react";
import { DUR_SLOW, EASE_OUT } from "@/lib/motion";

/**
 * Ръчно „зачертаване" под акцентната дума в hero H1 — SVG щрих, който се
 * дорисува при зареждане (ember-ът е брандовият момент на hero-то, спец §3).
 * Reduced-motion: MotionConfig изключва анимацията → щрихът стои дорисуван.
 */
export function ScribbleUnderline() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 120 14"
      preserveAspectRatio="none"
      className="absolute inset-x-0 -bottom-1.5 -z-10 h-3.5 w-full text-ember-500"
    >
      <m.path
        d="M3 9 C 24 4, 45 11, 64 7 S 100 6, 117 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.85 }}
        transition={{ delay: 0.5, duration: DUR_SLOW, ease: EASE_OUT }}
      />
      <m.path
        d="M8 12 C 34 8, 68 13, 112 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.5 }}
        transition={{ delay: 0.75, duration: DUR_SLOW, ease: EASE_OUT }}
      />
    </svg>
  );
}
