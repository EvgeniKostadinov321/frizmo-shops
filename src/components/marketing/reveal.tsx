"use client";

import { m, useReducedMotion } from "motion/react";
import { fadeUp } from "@/lib/motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Забавяне в секунди — за каскадни появи в грид. */
  delay?: number;
};

/**
 * Scroll reveal чрез Motion whileInView. Уважава prefers-reduced-motion
 * (показва съдържанието статично, без анимация) — WCAG 2.3.3.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={fadeUp}
      transition={{ delay }}
    >
      {children}
    </m.div>
  );
}
