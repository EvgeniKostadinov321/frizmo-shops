"use client";

import { Children } from "react";
import { m } from "motion/react";
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
 * Reduced-motion се поема централно от MotionConfig (hydration-safe).
 */
export function RevealList({ children, className, itemClassName, stagger = 0.06 }: RevealListProps) {
  const items = Children.toArray(children);

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
