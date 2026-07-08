/**
 * Малък CSV парсер/сериализатор (RFC 4180) — без външна библиотека.
 * Поддържа: кавички, escaped кавички (""), запетаи/нови редове в стойности,
 * CRLF и LF, и `;` като разделител (Excel с BG регионални настройки изнася с `;`).
 */

/** Открива разделителя от header реда (извън кавички): `;` или `,`. */
export function detectDelimiter(headerLine: string): "," | ";" {
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  for (const ch of headerLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ",") commas++;
    else if (!inQuotes && ch === ";") semis++;
  }
  return semis > commas ? ";" : ",";
}

/** Парсва CSV текст до редове от стойности. BOM се маха. Празни редове се пропускат. */
export function parseCsv(text: string, delimiter?: "," | ";"): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const delim = delimiter ?? detectDelimiter(input.split(/\r?\n/, 1)[0] ?? "");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  /* Последният ред (без завършващ newline). */
  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);

  return rows;
}

/** Escape на стойност за CSV (кавички при нужда). */
function csvField(value: string): string {
  return /[",;\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Сериализира редове до CSV текст с BOM + CRLF (Excel на Windows чете кирилицата). */
export function toCsv(rows: string[][]): string {
  return "\uFEFF" + rows.map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}
