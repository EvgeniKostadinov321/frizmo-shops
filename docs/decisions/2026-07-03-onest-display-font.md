# ADR: Onest replaces Sofia Sans Condensed as the platform display font

**Date:** 2026-07-03
**Status:** Accepted

## Context

The "Пазарен ден" design language (2026-07-03) used Sofia Sans Condensed
ExtraBold for display headings platform-wide. The 2026-07-03 visual
redesign spec ("Тих премиум с жив продукт") calls for Onest 700/800 as
the display role instead, citing stronger character at large sizes while
keeping full Cyrillic coverage — required since all shop owners and
buyers are Bulgarian (`CLAUDE-frontend.md` mobile/BG-copy rules).
Onest's Cyrillic + Cyrillic-Ext subsets were verified against the Google
Fonts CSS API before adoption.

Separately, the storefront `modern` theme (`src/lib/themes.ts`) uses
Space Grotesk, which has **no Cyrillic support at all** — a pre-existing
bug unrelated to this landing-only plan. That theme is NOT touched here;
it is tracked as follow-up scope for a future storefront-themes plan.

## Decision

- `--font-display` (platform-wide token, used by `.font-display` utility)
  now resolves to Onest first, falling back to Sofia Sans.
- `Sofia_Sans_Condensed` import stays in `src/app/layout.tsx` for now
  (unused directly by landing after this change, but removing it is
  deferred to avoid touching non-landing surfaces in a landing-only plan).
- `Space_Grotesk` (storefront `modern` theme) is explicitly out of scope
  for this ADR and this plan — flagged for a separate storefront-themes
  redesign plan.

## Consequences

- Landing headings render in Onest; visual diff expected on every
  landing screenshot.
- No change to `/s/{slug}` storefront rendering.
- Follow-up work item: either remove the now-unused `Sofia_Sans_Condensed`
  import once no surface references `--font-sofia-cond`, or repurpose it.
