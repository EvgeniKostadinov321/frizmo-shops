"use server";

import { getConfirmedSubscribers } from "@/db/queries/subscribers";
import { requireShop } from "@/lib/auth";
import { ok, type ActionResult } from "@/lib/action-result";

/** Форматира дата за CSV (YYYY-MM-DD). */
function fmtDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

/** Екранира CSV поле (кавички + запетаи). */
function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Генерира CSV с потвърдените абонати на магазина (само собственика).
 * Връща съдържанието — клиентът го сваля като файл.
 */
export async function exportSubscribersCsv(): Promise<ActionResult<{ csv: string; count: number }>> {
  const { shop } = await requireShop();
  const rows = await getConfirmedSubscribers(shop.id);

  const header = "email,confirmed_at";
  const body = rows
    .map((r) => `${csvCell(r.email)},${csvCell(fmtDate(r.confirmedAt))}`)
    .join("\n");
  const csv = `${header}\n${body}`;

  return ok({ csv, count: rows.length });
}
