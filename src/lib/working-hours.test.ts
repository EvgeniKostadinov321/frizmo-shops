import { describe, expect, it } from "vitest";
import { defaultWorkingDays, formatWorkingHours, type WorkingDay } from "./working-hours";

describe("formatWorkingHours", () => {
  it("групира дефолтния график", () => {
    expect(formatWorkingHours(defaultWorkingDays())).toEqual([
      "Пон – Пет: 09:00 – 18:00",
      "Съб – Нед: почивен ден",
    ]);
  });

  it("самостоятелен ден не се групира", () => {
    const days: WorkingDay[] = defaultWorkingDays();
    days[2] = { closed: false, open: "10:00", close: "14:00" };
    expect(formatWorkingHours(days)).toEqual([
      "Пон – Вт: 09:00 – 18:00",
      "Ср: 10:00 – 14:00",
      "Четв – Пет: 09:00 – 18:00",
      "Съб – Нед: почивен ден",
    ]);
  });

  it("невалидна дължина дава празен резултат", () => {
    expect(formatWorkingHours([])).toEqual([]);
  });
});
