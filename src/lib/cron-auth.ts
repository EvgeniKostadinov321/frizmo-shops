import { timingSafeEqual } from "node:crypto";

/**
 * Гард за Vercel Cron route-овете (одит #4 SEC-HDR-02): проверява Bearer CRON_SECRET с
 * constant-time сравнение, за да не изтича секретът през timing (хигиена — cron-ите пазят
 * финансови операции). Връща true ако е оторизиран. Един източник за четирите cron-а.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  /* timingSafeEqual хвърля при различна дължина → предварителна проверка (дължината така или
     иначе не е тайна). */
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
