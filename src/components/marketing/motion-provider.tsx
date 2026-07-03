"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";

/**
 * LazyMotion зарежда само domAnimation фийчърите (~15KB gz) вместо пълния
 * motion бандъл — задължителна конвенция (виж eslint правилото за m. vs motion.).
 * reducedMotion="user" изключва transform анимациите при prefers-reduced-motion
 * централно — компонентите НЕ бива да разклоняват markup по useReducedMotion
 * (сървърът винаги рендерира "false" → hydration mismatch).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>{children}</LazyMotion>
    </MotionConfig>
  );
}
