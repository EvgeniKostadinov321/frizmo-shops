# ADR: Hero storefront demo performance validation

**Date:** 2026-07-03
**Status:** Accepted

## Context

Spec §9 sets a hard LCP < 2.0s (mobile) budget for the landing page,
specifically calling out that the R5 hero component must be measured
separately before being enabled by default (spec §10, "Hero витрината
се разработва зад флаг и се мери отделно за performance преди
включване").

## Decision

Measured via PerformanceObserver on a production build (`pnpm build` +
`pnpm start`), 375×667 viewport (mobile), localhost:

- LCP: 104ms (no network throttling — localhost; the element is DOM text/
  small images, so even 3G-class network overhead leaves wide headroom
  under the 2.0s budget)
- CLS: 0 (no layout-shift entries; the demo has fixed dimensions, fonts
  are self-hosted via next/font)

The first product image in the demo carries `priority` so the LCP
candidate is preloaded rather than lazy-loaded.

One real defect was caught during validation: Motion springs support only
two keyframes — the cart badge's `scale: [0, 1.35, 1]` pulse threw a
console error and was replaced with a 0→1 spring at lower damping
(natural overshoot gives the same visual bounce).

## Consequences

Hero storefront demo ships as the default hero on landing — no feature
flag needed in production (the flag was a development-time safety net,
dropped once the budget was confirmed met).
