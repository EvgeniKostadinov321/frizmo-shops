"use client";

import { m } from "motion/react";
import { fadeUp } from "@/lib/motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Забавяне в секунди — за каскадни появи в грид. */
  delay?: number;
};

/**
 * Scroll reveal чрез Motion whileInView. Reduced-motion се поема централно
 * от MotionConfig в MotionProvider (без markup разклонение — hydration-safe).
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
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
