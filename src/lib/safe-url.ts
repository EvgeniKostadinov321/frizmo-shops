/**
 * Защита срещу stored XSS през потребителски href полета (одит #2 VAL-01).
 * z.url() в текущата Zod ПРИЕМА javascript:/data:/vbscript: URL-и → търговец можеше да
 * сложи такъв линк (social/CTA/announcement/navLink), който на публичния storefront става
 * <a href="javascript:…"> и изпълнява JS в сесията на купувача при клик.
 *
 * Разрешаваме само безопасни цели: вътрешен път (/…), абсолютен http(s)://, mailto:, tel:.
 * Отхвърляме всичко друго (javascript:, data:, vbscript:, file:, scheme-relative //evil).
 */

/** true ако href-ът е безопасен за рендер като линк. Празният низ е валиден (= няма линк). */
export function isSafeHref(value: string): boolean {
  const s = value.trim();
  if (s === "") return true;
  // Вътрешен път (но НЕ scheme-relative „//host" — то сочи външен хост по подразбиране).
  if (s.startsWith("/") && !s.startsWith("//")) return true;
  const lower = s.toLowerCase();
  if (lower.startsWith("mailto:") || lower.startsWith("tel:")) return true;
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false; // не е абсолютен URL и не е разрешен относителен → отхвърли
  }
}

/** Неутрализира опасен href при РЕНДЕР (belt-and-suspenders за легаси стойности в базата). */
export function safeHref(value: string | null | undefined): string {
  if (!value) return "";
  return isSafeHref(value) ? value.trim() : "";
}
