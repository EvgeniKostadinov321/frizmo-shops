/**
 * Валиден GTIN: точно 8/12/13/14 цифри + коректна GS1 mod-10 контролна цифра.
 * Празен/невалиден вход → false. Използва се във feed-а (g:gtin) и Zod валидацията.
 */
export function isValidGtin(raw: string): boolean {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return false;
  if (![8, 12, 13, 14].includes(s.length)) return false;
  const digits = s.split("").map(Number);
  const check = digits.pop()!;
  /* GS1 mod-10: отдясно наляво без последната цифра — тегла 3,1,3,1… */
  let sum = 0;
  for (let i = digits.length - 1, pos = 0; i >= 0; i--, pos++) {
    sum += digits[i]! * (pos % 2 === 0 ? 3 : 1);
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === check;
}
