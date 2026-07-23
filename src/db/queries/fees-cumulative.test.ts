import { beforeEach, describe, expect, it, vi } from "vitest";

/* BL-01 (одит #3): getCumulativeBillableBalance трябва да смята
   дължимо = кумулативен нетен ledger (до periodEnd) − вече наплатени положителни фактури,
   за да НЕ губи cross-month кредит от връщане. Мокваме трите select-а (период / кумулатив /
   наплатено) и проверяваме формулата за сценария от ADR. */

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }));

vi.mock("@/db", () => ({
  db: { select: selectMock },
  feeEvents: { shopId: "shopId", type: "type", amountCents: "amountCents", occurredAt: "occurredAt" },
  feeInvoices: { shopId: "shopId", periodStart: "periodStart", amountDueCents: "amountDueCents" },
  subscriptions: {},
}));
vi.mock("@/lib/fee", () => ({ feeBaseCents: vi.fn(), feeCents: vi.fn(), FEE_GRACE_DAYS: 14 }));

import { getCumulativeBillableBalance } from "@/db/queries/fees";

/** Реди трите select-а в реда, в който функцията ги вика: период → кумулатив → наплатено. */
function stubSelects(period: { charges: number; credits: number }, net: number, paid: number) {
  const rows = [
    [{ charges: period.charges, credits: period.credits }],
    [{ net }],
    [{ paid }],
  ];
  let i = 0;
  selectMock.mockImplementation(() => ({
    from: () => ({ where: () => Promise.resolve(rows[i++]) }),
  }));
}

const START = new Date("2026-04-01T00:00:00Z");
const END = new Date("2026-05-01T00:00:00Z");

describe("getCumulativeBillableBalance (BL-01 running balance)", () => {
  beforeEach(() => selectMock.mockReset());

  it("месец само с charge → дължимо = charge (нищо наплатено преди)", async () => {
    stubSelects({ charges: 500, credits: 0 }, 500, 0); // март еквивалент
    const r = await getCumulativeBillableBalance("s1", START, END);
    expect(r.amountDueCents).toBe(500);
  });

  it("cross-month кредит: месец само с credit → отрицателно (кредитът НЕ се губи)", async () => {
    // април: период credit 500; кумулатив нето 0 (март 500 − април 500); наплатено 500 (март).
    stubSelects({ charges: 0, credits: 500 }, 0, 500);
    const r = await getCumulativeBillableBalance("s1", START, END);
    expect(r.amountDueCents).toBe(-500); // ≤0 → cron не фактурира, но кредитът остава в кумулатива
    expect(r.creditsCents).toBe(500); // за одит полето на фактурата
  });

  it("следващ месец charge, но стар кредит още покрива → пак отрицателно", async () => {
    // май: период charge 300; кумулатив 300 (500−500+300); наплатено 500 → 300−500 = −200.
    stubSelects({ charges: 300, credits: 0 }, 300, 500);
    const r = await getCumulativeBillableBalance("s1", START, END);
    expect(r.amountDueCents).toBe(-200);
  });

  it("кредитът се изчерпва → дължимо = остатъкът", async () => {
    // юни: период charge 400; кумулатив 700 (500−500+300+400); наплатено 500 → 700−500 = 200.
    stubSelects({ charges: 400, credits: 0 }, 700, 500);
    const r = await getCumulativeBillableBalance("s1", START, END);
    expect(r.amountDueCents).toBe(200);
    // Общо платено през 4-те месеца = 500 + 200 = 700 = реалните такси (300+400). ✓
  });
});
