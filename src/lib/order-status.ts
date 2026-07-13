/**
 * Позволени преходи между статуси на поръчка. Чиста данна (не в orders.ts, защото
 * "use server" файл експортира само async функции; тестваема и реюзваема оттук).
 *
 * `pending_payment` (онлайн плащане) → `new` (webhook: платено) или `cancelled`
 * (webhook: отказано/изтекло ИЛИ cron auto-cancel). Търговецът НЕ бута плащане ръчно.
 */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ["new", "cancelled"],
  new: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  return_requested: ["returned", "completed"],
  returned: [],
};

/** BG етикети на статусите — за купувача (потвърждение, „моите поръчки"). */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Чака плащане",
  new: "Приета",
  confirmed: "Потвърдена",
  shipped: "Изпратена",
  completed: "Завършена",
  cancelled: "Отказана",
  return_requested: "Заявено връщане",
  returned: "Върната",
};
