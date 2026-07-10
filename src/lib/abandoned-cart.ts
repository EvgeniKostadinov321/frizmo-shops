/**
 * Кои pending колички са зрели за напомнящ имейл (изоставени > thresholdMs).
 * Чиста функция — тества се без DB. Заявката в queries прави същия филтър в SQL
 * за ефективност; тук е референтната логика + за тестове.
 */
export function dueAbandonedCarts<T extends { status: string; updatedAt: Date }>(
  carts: T[],
  now: Date,
  thresholdMs = 60 * 60 * 1000,
): T[] {
  return carts.filter(
    (c) => c.status === "pending" && now.getTime() - c.updatedAt.getTime() >= thresholdMs,
  );
}
