const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Едноредов текст: имена, заглавия, телефони. */
export function sanitizeText(input: string, maxLength = 500): string {
  return input.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Многоредов текст: описания. Пази новите редове, маха останалите контролни знаци. */
export function sanitizeMultiline(input: string, maxLength = 10_000): string {
  return input
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}
