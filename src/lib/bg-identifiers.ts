/**
 * Валидация на български ЕГН и ЕИК/Булстат чрез контролна цифра (не само дължина).
 * Използва се в billing-details схемата — невалиден идентификатор в НАП фактура =
 * inv.bg я отказва → зависнала фактура. По-добре да го хванем на входа.
 */

/** ЕГН: 10 цифри, вградена дата + контролна цифра (тегла 2,4,8,5,10,9,7,3,6). */
export function isValidEgn(egn: string): boolean {
  if (!/^\d{10}$/.test(egn)) return false;

  const digits = egn.split("").map(Number);

  // Проверка на датата (месец с +40 за 2000+, +20 за 1800-те).
  const year = digits[0]! * 10 + digits[1]!;
  let month = digits[2]! * 10 + digits[3]!;
  const day = digits[4]! * 10 + digits[5]!;
  let fullYear: number;
  if (month > 40) {
    month -= 40;
    fullYear = 2000 + year;
  } else if (month > 20) {
    month -= 20;
    fullYear = 1800 + year;
  } else {
    fullYear = 1900 + year;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(fullYear, month - 1, day);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return false;

  // Контролна цифра.
  const weights = [2, 4, 8, 5, 10, 9, 7, 3, 6];
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i]!, 0);
  const check = sum % 11 % 10;
  return check === digits[9];
}

/** ЕИК: 9-цифрен (стандартен) с двустепенна контролна цифра, или 13 (клон — приемаме по дължина). */
export function isValidEik(eik: string): boolean {
  if (/^\d{13}$/.test(eik)) return true; // клон/поделение — базовият 9-значен вече е валидиран при регистрация
  if (!/^\d{9}$/.test(eik)) return false;

  const digits = eik.split("").map(Number);

  // Първа контролна цифра (тегла 1..8).
  let sum = digits.slice(0, 8).reduce((acc, d, i) => acc + d * (i + 1), 0);
  let check = sum % 11;
  if (check === 10) {
    // Втори опит с тегла 3..10.
    sum = digits.slice(0, 8).reduce((acc, d, i) => acc + d * (i + 3), 0);
    check = sum % 11;
    if (check === 10) check = 0;
  }
  return check === digits[8];
}
