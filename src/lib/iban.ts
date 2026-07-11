/** Нормализира: маха интервали, uppercase. */
function normalize(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/**
 * BG IBAN валидация: точно 22 символа, префикс BG, ISO 7064 mod-97 = 1.
 * BG форматът е BGkk BBBB SSSS DD AAAAAAAA (22 символа общо).
 */
export function isValidBgIban(raw: string): boolean {
  const iban = normalize(raw);
  if (iban.length !== 22) return false;
  if (!/^BG\d{2}[A-Z]{4}\d{6}[A-Z0-9]{8}$/.test(iban)) return false;

  /* mod-97: премести първите 4 символа в края, буквите → числа (A=10..Z=35). */
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch >= "A" && ch <= "Z" ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const digit of code) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/** Показва IBAN на групи по 4 (за четимост). Съхранението остава нормализирано. */
export function formatIban(raw: string): string {
  return normalize(raw).replace(/(.{4})/g, "$1 ").trim();
}
