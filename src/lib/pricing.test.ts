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
