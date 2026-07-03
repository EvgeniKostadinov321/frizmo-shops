# Frizmo Shops — AI Asset Prompts

Документация на style prompts за консистентни AI-генерирани активи (спец §18).
Всеки prompt се пази тук за възпроизводимост — следващо разширение на серията
използва същия style prompt. **Статус:** документирано; генерирането на самите
серии е отложено по решение на собственика (2026-07-03) — Unsplash снимките от
`scripts/seed-demo-shops.mjs` работят дотогава.

## Демо магазини — фото серии

### Ферма Зелена долина (храни, earthy топли тонове)

**Style prompt:** "Professional food product photography, warm earthy tones,
natural window light from the left, rustic wooden surface background,
shallow depth of field, 50mm lens equivalent, Bulgarian farm dairy products
(cheese, honey, eggs), photorealistic, no text overlays, no watermarks,
no visible hands or people"

**Crop стандарт:** 4:5 продуктови снимки, 21:9 hero банер.

### Ателие Ръчичка (ръчна изработка, текстурни близки планове)

**Style prompt:** "Close-up macro photography of handmade craft products,
textured wood/fabric background, soft diffused studio light, warm neutral
tones, shallow depth of field emphasizing texture and craftsmanship,
photorealistic, no text overlays, no watermarks, no visible hands or people"

**Crop стандарт:** 4:5 продуктови снимки, 21:9 hero банер.

### Глоу Козметика (козметика, студийни неутрални тонове)

**Style prompt:** "Clean studio product photography, neutral gray/white
background, soft even lighting, minimal shadows, cosmetics products
(bottles, jars, packaging), photorealistic, no text overlays, no
watermarks, no visible hands or people"

**Crop стандарт:** 4:5 продуктови снимки, 21:9 hero банер.

## Ambient видео (R6.5, отложено)

Ако/когато се произведе: 6–8s loop, без звук, AV1/H.265, ≤1.5MB, `poster`
кадър, art-direction по prompt-а на съответната ниша, бранд duotone грейд.

## Правила

1. Всеки AI актив минава човешки преглед за бранд съответствие и артефакти
   (ръце, изкривени текстове в изображения) преди качване в Supabase Storage.
2. Никакви AI изображения на разпознаваеми хора.
3. Финалните файлове се оптимизират (AVIF/WebP) преди качване.
4. При генериране: пътищата следват конвенцията `shops/{shopId}/products/...`
   (виж CLAUDE-backend.md), а `scripts/seed-demo-shops.mjs` се обновява да
   сочи новите източници.
