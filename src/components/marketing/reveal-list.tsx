"use client";

import { Children } from "react";
import { m, useReducedMotion } from "motion/react";
import { fadeUp, staggerContainer } from "@/lib/motion";

type RevealListProps = {
  children: React.ReactNode;
  /** Класове за контейнера (grid/flex layout-ът живее тук). */
  className?: string;
  /** Класове за обвивката на всеки елемент. */
  itemClassName?: string;
  /** Интервал между децата в секунди. */
  stagger?: number;
};

/**
 * Stagger grid reveal: децата влизат каскадно при влизане във viewport-а.
 * Server Components подават чист JSX; обвивката е клиентска (Motion).
 * Уважава prefers-reduced-motion (статично съдържание) — WCAG 2.3.3.
 */
export function RevealList({ children, className, itemClassName, stagger = 0.06 }: RevealListProps) {
  const reducedMotion = useReducedMotion();
  const items = Children.toArray(children);

  if (reducedMotion) {
    return (
      <div className={className}>
        {items.map((child, i) => (
          <div key={i} className={itemClassName}>
            {child}
          </div>
        ))}
      </div>
    );
  }

  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={staggerContainer(stagger)}
    >
      {items.map((child, i) => (
        <m.div key={i} variants={fadeUp} className={itemClassName}>
          {child}
        </m.div>
      ))}
    </m.div>
  );
}
