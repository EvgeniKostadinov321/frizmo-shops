/**
 * Безопасно сериализиране на JSON-LD за вграждане в <script> през
 * dangerouslySetInnerHTML.
 *
 * JSON.stringify НЕ escape-ва ъгловите скоби, амперсанда, нито невидимите line
 * separator-и U+2028/U+2029. Ако сериализираме потребителски вход (име/описание
 * на магазин или продукт), стойност, която затваря script тага, изпълнява
 * произволен JS у всеки посетител (stored XSS). Заместваме тези кодове с
 * екранираните им еквиваленти — валиден JSON, но безвреден в HTML.
 *
 * Сепараторите се строят с fromCharCode, за да не пишем суровия символ в този
 * файл (той е JS line terminator и би счупил парсера).
 */
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll(LINE_SEP, "\\u2028")
    .replaceAll(PARA_SEP, "\\u2029");
}
