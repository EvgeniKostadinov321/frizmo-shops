"use client";

import { useRef } from "react";

type PricingCardSpotlightProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Radial-gradient overlay, следващ курсора — фин „погледни ме" на ценовите
 * карти (спец §14). Чист CSS + 1 mousemove listener; на тъч устройства няма
 * hover и слоят просто не се показва.
 */
export function PricingCardSpotlight({ children, className }: PricingCardSpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--spotlight-x", `${e.clientX - rect.left}px`);
    node.style.setProperty("--spotlight-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`group/spotlight relative h-full ${className ?? ""}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-card opacity-0 transition-opacity duration-300 group-hover/spotlight:opacity-100"
        style={{
          background:
            "radial-gradient(400px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), rgb(20 102 90 / 0.08), transparent 60%)",
        }}
      />
      {children}
    </div>
  );
}
