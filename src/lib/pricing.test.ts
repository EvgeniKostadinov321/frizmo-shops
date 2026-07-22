import { describe, expect, it } from "vitest";
import { priceCart, type PricingProduct } from "./pricing";

function product(overrides: Partial<PricingProduct> = {}): PricingProduct {
  return {
    id: "p1",
    name: "Тениска",
    status: "active",
    priceCents: 2000,
    promoPriceCents: null,
    stock: null,
    variants: [],
    deal: null,
    madeToOrder: false,
    leadDaysMin: null,
    leadDaysMax: null,
    ...overrides,
  };
}

const productsMap = (...items: PricingProduct[]) => new Map(items.map((p) => [p.id, p]));

describe("priceCart — единични цени", () => {
  it("базова цена", () => {
    const cart = priceCart([{ productId: "p1", variantKey: null, qty: 2 }], productsMap(product()));
    expect(cart.lines[0]).toMatchObject({ unitPriceCents: 2000, lineTotalCents: 4000 });
    expect(cart.subtotalCents).toBe(4000);
    expect(cart.hasErrors).toBe(false);
  });

  it("промо цена бие базовата", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: null, qty: 1 }],
      productsMap(product({ promoPriceCents: 1500 })),
    );
    expect(cart.lines[0]!.unitPriceCents).toBe(1500);
  });

  it("вариантна цена бие промото", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: "Размер:XL", qty: 1 }],
      productsMap(
        product({
          promoPriceCents: 1500,
          variants: [{ key: "Размер:XL", label: "XL", priceCents: 2500, stock: null }],
        }),
      ),
    );
    expect(cart.lines[0]!.unitPriceCents).toBe(2500);
  });

  it("вариант без собствена цена наследява промото", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: "Размер:M", qty: 1 }],
      productsMap(
        product({
          promoPriceCents: 1500,
          variants: [{ key: "Размер:M", label: "M", priceCents: null, stock: null }],
        }),
      ),
    );
    expect(cart.lines[0]!.unitPriceCents).toBe(1500);
  });
});

describe("priceCart — количествени промоции", () => {
  const dealProduct = product({ deal: { quantity: 2, totalPriceCents: 3000 } });

  it("точно N: deal цената", () => {
    const cart = priceCart([{ productId: "p1", variantKey: null, qty: 2 }], productsMap(dealProduct));
    expect(cart.lines[0]!.lineTotalCents).toBe(3000);
    expect(cart.lines[0]!.appliedDeal).not.toBe("");
  });

  it("2N+1: два deal-а + една единична", () => {
    const cart = priceCart([{ productId: "p1", variantKey: null, qty: 5 }], productsMap(dealProduct));
    expect(cart.lines[0]!.lineTotalCents).toBe(3000 + 3000 + 2000);
  });

  it("под N: без deal", () => {
    const cart = priceCart([{ productId: "p1", variantKey: null, qty: 1 }], productsMap(dealProduct));
    expect(cart.lines[0]!.lineTotalCents).toBe(2000);
    expect(cart.lines[0]!.appliedDeal).toBe("");
  });

  it("остатъкът ползва промо цената, ако има", () => {
    const p = product({ promoPriceCents: 1800, deal: { quantity: 2, totalPriceCents: 3000 } });
    const cart = priceCart([{ productId: "p1", variantKey: null, qty: 3 }], productsMap(p));
    expect(cart.lines[0]!.lineTotalCents).toBe(3000 + 1800);
  });
});

describe("priceCart — грешки и наличности", () => {
  it("липсващ продукт", () => {
    const cart = priceCart([{ productId: "x", variantKey: null, qty: 1 }], productsMap());
    expect(cart.lines[0]!.error).toBe("not_found");
    expect(cart.hasErrors).toBe(true);
  });

  it("неактивен продукт", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: null, qty: 1 }],
      productsMap(product({ status: "inactive" })),
    );
    expect(cart.lines[0]!.error).toBe("inactive");
  });

  it("изтрит вариант", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: "Размер:XXL", qty: 1 }],
      productsMap(product({ variants: [{ key: "Размер:M", label: "M", priceCents: null, stock: null }] })),
    );
    expect(cart.lines[0]!.error).toBe("variant_missing");
  });

  it("недостатъчна продуктова наличност", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: null, qty: 5 }],
      productsMap(product({ stock: 3 })),
    );
    expect(cart.lines[0]!.error).toBe("insufficient_stock");
  });

  it("изчерпана вариантна наличност", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: "Размер:M", qty: 1 }],
      productsMap(product({ variants: [{ key: "Размер:M", label: "M", priceCents: null, stock: 0 }] })),
    );
    expect(cart.lines[0]!.error).toBe("out_of_stock");
  });

  it("qty < 1 се отхвърля", () => {
    const cart = priceCart([{ productId: "p1", variantKey: null, qty: 0 }], productsMap(product()));
    expect(cart.hasErrors).toBe(true);
  });

  it("stockLeft носи ефективната наличност (продуктова)", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: null, qty: 2 }],
      productsMap(product({ stock: 7 })),
    );
    expect(cart.lines[0]!.stockLeft).toBe(7);
  });

  it("stockLeft носи вариантната наличност при вариант", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: "Размер:M", qty: 1 }],
      productsMap(
        product({
          stock: 99,
          variants: [{ key: "Размер:M", label: "M", priceCents: null, stock: 4 }],
        }),
      ),
    );
    expect(cart.lines[0]!.stockLeft).toBe(4);
  });

  it("stockLeft е null при неследена наличност", () => {
    const cart = priceCart([{ productId: "p1", variantKey: null, qty: 3 }], productsMap(product()));
    expect(cart.lines[0]!.stockLeft).toBeNull();
  });
});

describe("priceCart — доставка", () => {
  const shipping = { name: "Куриер", priceCents: 500, freeOverCents: 6000 };

  it("под прага: плаща се", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: null, qty: 1 }],
      productsMap(product()),
      shipping,
    );
    expect(cart.shipping).toMatchObject({ priceCents: 500, freeApplied: false });
    expect(cart.totalCents).toBe(2500);
  });

  it("точно на прага: безплатна", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: null, qty: 3 }],
      productsMap(product()),
      shipping,
    );
    expect(cart.shipping).toMatchObject({ priceCents: 0, freeApplied: true });
    expect(cart.totalCents).toBe(6000);
  });

  it("без метод: само subtotal", () => {
    const cart = priceCart([{ productId: "p1", variantKey: null, qty: 1 }], productsMap(product()));
    expect(cart.shipping).toBeNull();
    expect(cart.totalCents).toBe(2000);
  });

  it("празна количка", () => {
    const cart = priceCart([], productsMap(), shipping);
    expect(cart.subtotalCents).toBe(0);
    expect(cart.lines).toHaveLength(0);
  });
});

describe("priceCart — промо кодове", () => {
  const line = [{ productId: "p1", variantKey: null, qty: 1 }]; // subtotal 2000

  it("процентна отстъпка върху subtotal-а", () => {
    const cart = priceCart(line, productsMap(product()), undefined, {
      code: "MINUS10",
      discountType: "percent",
      discountValue: 10,
      minSubtotalCents: 0,
    });
    expect(cart.discountCents).toBe(200); // 10% от 2000
    expect(cart.appliedCouponCode).toBe("MINUS10");
    expect(cart.totalCents).toBe(1800);
  });

  it("фиксирана отстъпка", () => {
    const cart = priceCart(line, productsMap(product()), undefined, {
      code: "MINUS5",
      discountType: "fixed",
      discountValue: 500,
      minSubtotalCents: 0,
    });
    expect(cart.discountCents).toBe(500);
    expect(cart.totalCents).toBe(1500);
  });

  it("фиксирана отстъпка не сваля под 0", () => {
    const cart = priceCart(line, productsMap(product()), undefined, {
      code: "BIG",
      discountType: "fixed",
      discountValue: 9999,
      minSubtotalCents: 0,
    });
    expect(cart.discountCents).toBe(2000); // само до subtotal-а
    expect(cart.totalCents).toBe(0);
  });

  it("минимална сума не е достигната → без отстъпка", () => {
    const cart = priceCart(line, productsMap(product()), undefined, {
      code: "MIN50",
      discountType: "percent",
      discountValue: 10,
      minSubtotalCents: 5000,
    });
    expect(cart.discountCents).toBe(0);
    expect(cart.appliedCouponCode).toBe("");
    expect(cart.couponError).toBe("min_not_met");
    expect(cart.totalCents).toBe(2000);
  });

  it("купон + доставка: отстъпка преди доставка", () => {
    const cart = priceCart(
      line,
      productsMap(product()),
      { name: "Куриер", priceCents: 500, freeOverCents: null },
      { code: "MINUS10", discountType: "percent", discountValue: 10, minSubtotalCents: 0 },
    );
    expect(cart.discountCents).toBe(200);
    expect(cart.totalCents).toBe(2300); // 2000 - 200 + 500
  });

  it("безплатна доставка се смята по оригиналния subtotal (не намаления)", () => {
    /* subtotal 2000, купон -50%, праг за безплатна = 2000. Купонът НЕ бива да
       отнема безплатната доставка. */
    const cart = priceCart(
      line,
      productsMap(product()),
      { name: "Куриер", priceCents: 500, freeOverCents: 2000 },
      { code: "HALF", discountType: "percent", discountValue: 50, minSubtotalCents: 0 },
    );
    expect(cart.shipping).toMatchObject({ priceCents: 0, freeApplied: true });
    expect(cart.totalCents).toBe(1000); // 2000 - 1000 + 0
  });
});

describe("priceCart — подаръчна опаковка (N9)", () => {
  const line = [{ productId: "p1", variantKey: null, qty: 1 }];

  it("таксата влиза в total и в полето giftWrapFeeCents", () => {
    const cart = priceCart(line, productsMap(product()), undefined, undefined, 200);
    expect(cart.giftWrapFeeCents).toBe(200);
    expect(cart.totalCents).toBe(2200); // 2000 + 200
  });

  it("без такса → 0, total непроменен", () => {
    const cart = priceCart(line, productsMap(product()));
    expect(cart.giftWrapFeeCents).toBe(0);
    expect(cart.totalCents).toBe(2000);
  });

  it("опаковка + доставка + купон заедно", () => {
    const cart = priceCart(
      line,
      productsMap(product()),
      { name: "Куриер", priceCents: 500, freeOverCents: null },
      { code: "MINUS10", discountType: "percent", discountValue: 10, minSubtotalCents: 0 },
      200,
    );
    expect(cart.totalCents).toBe(2500); // 2000 - 200 + 500 + 200
  });

  it("празна количка не добавя такса (няма поръчка)", () => {
    const cart = priceCart([], productsMap(), undefined, undefined, 200);
    expect(cart.giftWrapFeeCents).toBe(0);
    expect(cart.totalCents).toBe(0);
  });

  it("отрицателна такса се клампва към 0 (защита)", () => {
    const cart = priceCart(line, productsMap(product()), undefined, undefined, -500);
    expect(cart.giftWrapFeeCents).toBe(0);
    expect(cart.totalCents).toBe(2000);
  });
});

describe("priceCart — ръчна изработка (made-to-order)", () => {
  const mtoLine = [{ productId: "p1", variantKey: null, qty: 2 }];

  it("готова наличност покрива количеството → НЕ е по изработка", () => {
    const cart = priceCart(
      mtoLine,
      productsMap(product({ stock: 5, madeToOrder: true, leadDaysMin: 10, leadDaysMax: 14 })),
    );
    expect(cart.hasErrors).toBe(false);
    expect(cart.lines[0]!.madeToOrder).toBe(false);
  });

  it("stock=0 + madeToOrder → приема по изработка, носи срока, без грешка", () => {
    const cart = priceCart(
      mtoLine,
      productsMap(product({ stock: 0, madeToOrder: true, leadDaysMin: 10, leadDaysMax: 14 })),
    );
    expect(cart.hasErrors).toBe(false);
    expect(cart.lines[0]!.madeToOrder).toBe(true);
    expect(cart.lines[0]!.leadDaysMin).toBe(10);
    expect(cart.lines[0]!.leadDaysMax).toBe(14);
  });

  it("недостиг (stock=2, qty=5) + madeToOrder → цялото по изработка", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: null, qty: 5 }],
      productsMap(product({ stock: 2, madeToOrder: true, leadDaysMin: 7, leadDaysMax: 10 })),
    );
    expect(cart.hasErrors).toBe(false);
    expect(cart.lines[0]!.madeToOrder).toBe(true);
    expect(cart.lines[0]!.qty).toBe(5);
  });

  it("stock=0 + НЕ madeToOrder → out_of_stock (както преди)", () => {
    const cart = priceCart(mtoLine, productsMap(product({ stock: 0, madeToOrder: false })));
    expect(cart.hasErrors).toBe(true);
    expect(cart.lines[0]!.error).toBe("out_of_stock");
    expect(cart.lines[0]!.madeToOrder).toBe(false);
  });

  it("недостиг + НЕ madeToOrder → insufficient_stock", () => {
    const cart = priceCart(
      [{ productId: "p1", variantKey: null, qty: 5 }],
      productsMap(product({ stock: 2, madeToOrder: false })),
    );
    expect(cart.lines[0]!.error).toBe("insufficient_stock");
  });

  it("stock=null (не следи) + madeToOrder → минава, НЕ по изработка", () => {
    const cart = priceCart(
      mtoLine,
      productsMap(product({ stock: null, madeToOrder: true, leadDaysMin: 10, leadDaysMax: 14 })),
    );
    expect(cart.hasErrors).toBe(false);
    expect(cart.lines[0]!.madeToOrder).toBe(false);
  });
});
