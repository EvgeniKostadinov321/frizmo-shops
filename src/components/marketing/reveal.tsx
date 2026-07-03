"use client";

import { useEffect, useRef } from "react";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Забавяне в ms — за каскадни появи в грид. */
  delay?: number;
};

/**
 * Scroll reveal: съдържанието се появява меко при влизане във viewport-а.
 * Чист IntersectionObserver + CSS (.reveal в globals.css); уважава
 * prefers-reduced-motion. Съдържанието е видимо и без JS (no-js fallback).
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    node.classList.add("reveal");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add("reveal-visible");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
