# ADR: R6 optional effect layer — individual go/no-go decisions

**Date:** 2026-07-03
**Status:** Accepted (living document, one entry per R6 candidate)

Every decision below was made against the pre-R6 baseline screenshots
(`docs/design/r6-baseline/`), applying the spec's own stop-rule: "ако
страницата вече впечатлява, ефектът не се добавя" (§14).

## Soft parallax on hero background (R6.1)

**Decision:** Rejected.
**Reasoning:** The hero glow is ambient by design — a 0.85–0.92× scroll
drift on a 7%-opacity radial gradient is imperceptible in practice, and
the hero already carries the page's one orchestrated spectacle (the
storefront demo). Adding scroll-linked JS for an invisible effect fails
the "обяснява, не изглежда яко" test.

## Word-reveal H2 headings (R6.2)

**Decision:** Rejected.
**Reasoning:** Bulgarian section headings contain long compound words
("Продаваш през Facebook и Viber?" wraps unpredictably at display
sizes); staggering words makes mid-phrase breaks visually choppy during
the animation. The Onest display typography already gives headings
presence — the section-level fadeUp reveal is sufficient.

## Scroll-assembled "Как работи" step connector (R6.3)

**Decision:** Rejected.
**Reasoning:** The numbered steps (01–04 display numerals) already
communicate sequence unambiguously. A scroll-drawn connector line would
be redundant ornament, and it is the highest-complexity candidate
(nested useScroll inside an already-revealed section).

## Hover spotlight on pricing cards (R6.4)

**Decision:** Kept.
**Reasoning:** Desktop-only (no hover on touch — the layer simply never
shows), zero motion risk (pure CSS radial-gradient + one mousemove
listener), applied to the highest-conversion section. The effect is
subtle in the brand green at 8% opacity and doesn't clash with the Pro
card's tinted shadow.

## Ambient video in "На живо" section (R6.5)

**Decision:** Deferred — no video asset exists yet in the repo. This
requires the C1 content pass to produce a candidate clip (AV1/H.265,
≤1.5MB, 6-8s loop, no sound) before an implementation/rejection call can
be made. Revisit after C1.
