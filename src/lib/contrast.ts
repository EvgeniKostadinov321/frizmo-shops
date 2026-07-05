/**
 * Контраст утилити (WCAG). Използва се за --sf-on-primary: текстът върху
 * потребителския primary цвят се изчислява, не се гадае — търговецът може да
 * избере произволен цвят (неоново жълто, тъмно синьо...) и текстът върху него
 * винаги остава четим.
 */

/** WCAG relative luminance — sRGB → linear → luminance. 0 (черно) … 1 (бяло). */
export function luminance(hex: string): number {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)
    ?.map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  if (!channels || channels.length < 3) return 0;
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = luminance(hexA);
  const lumB = luminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Четим текстов цвят върху даден фон: бяло или почти-черно — което дава
 * по-висок контраст. За --sf-on-primary (бутони, промо ленти върху primary).
 */
export function onColor(bgHex: string): string {
  return contrastRatio(bgHex, "#ffffff") >= contrastRatio(bgHex, "#111111")
    ? "#ffffff"
    : "#111111";
}

/**
 * Акцентен цвят за ЕДРА типография (hero заглавия) върху даден фон: връща
 * акцента само ако покрива WCAG 3:1 за голям текст; иначе — четимия fallback.
 * Така „акцентната дума" никога не изчезва при неудачна комбинация
 * (светъл акцент върху светла тема и т.н.).
 */
export function accentInk(accentHex: string, bgHex: string, fallback: string): string {
  return contrastRatio(accentHex, bgHex) >= 3 ? accentHex : fallback;
}
