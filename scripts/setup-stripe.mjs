/**
 * Документация на Stripe billing setup-а (Products / Prices / Coupon / Promotion Code).
 *
 * Този файл НЕ се пуска в CI/прод. Той записва ТОЧНО как е създаден Stripe
 * setup-ът през Stripe CLI, за да е повторяемо (напр. при пренасяне от test →
 * live mode, или при пресъздаване на друг акаунт). Ресурсите се създават
 * веднъж ръчно от разработчика с логнато Stripe CLI (акаунт „FRIZMO").
 *
 * Стойностите долу са от TEST mode (livemode: false). За live mode пусни същите
 * команди с флаг `--live`, вземи новите `prod_`/`price_`/`promo_` id-та и ги
 * сложи в Vercel prod env vars (STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO).
 *
 * Пускане: `node scripts/setup-stripe.mjs` — само печата инструкциите (dry).
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1) Products (метадатата app=frizmo-shops изолира ресурсите ни в споделения
//    Stripe акаунт — виж docs/superpowers/specs/2026-07-10-stripe-billing-design.md)
//
//    stripe products create --name="Frizmo Shops — Starter" -d "metadata[app]=frizmo-shops"
//    stripe products create --name="Frizmo Shops — Pro"     -d "metadata[app]=frizmo-shops"
//
//    → prod_Ur59lnyRhGwQ7U  (Starter)
//    → prod_Ur590AQYoITG1g  (Pro)
//
// 2) Prices — месечен recurring, integer евроцентове (1000 = 10.00 €)
//
//    stripe prices create --product=prod_Ur59lnyRhGwQ7U --unit-amount=1000 --currency=eur -d "recurring[interval]=month"
//    stripe prices create --product=prod_Ur590AQYoITG1g --unit-amount=2000 --currency=eur -d "recurring[interval]=month"
//
//    → price_1TrMzNRq5DJiUm57bfqykBL1  (Starter, 10 €/мес)   ← STRIPE_PRICE_STARTER
//    → price_1TrMzORq5DJiUm57AWBgBv3q  (Pro, 20 €/мес)        ← STRIPE_PRICE_PRO
//
// 3) Coupon + Promotion Code — първи месец -50% (еднократно)
//
//    stripe coupons create --percent-off=50 --duration=once --name="Първи месец -50%" -d "metadata[app]=frizmo-shops"
//    → bzBjATf5
//
//    ВНИМАНИЕ: новото Stripe CLI иска promotion.type + promotion.coupon
//    (не старото --coupon=..., което дава parameter_missing: promotion[type]):
//
//    stripe promotion_codes create --promotion.type=coupon --promotion.coupon=bzBjATf5 --code=FRIZMO50 -d "metadata[app]=frizmo-shops" -c
//    → promo_1TrNO9Rq5DJiUm572B1fut6b  (code: FRIZMO50)
//
// 4) RAK (restricted API key) — създава се РЪЧНО в Dashboard (не през CLI):
//    Developers → API keys → Create restricted key. Минимални права:
//      Customers (write), Checkout Sessions (write), Billing Portal Sessions
//      (write), Subscriptions (read), Prices (read), Products (read),
//      Promotion codes (read).
//    → rk_test_...  ← STRIPE_SECRET_KEY (никога в git; само .env.local / Vercel)
// ─────────────────────────────────────────────────────────────────────────────

const TEST_RESOURCES = {
  products: {
    starter: "prod_Ur59lnyRhGwQ7U",
    pro: "prod_Ur590AQYoITG1g",
  },
  prices: {
    starter: "price_1TrMzNRq5DJiUm57bfqykBL1", // STRIPE_PRICE_STARTER (10 €/мес)
    pro: "price_1TrMzORq5DJiUm57AWBgBv3q", // STRIPE_PRICE_PRO (20 €/мес)
  },
  coupon: "bzBjATf5", // -50% once
  promotionCode: "FRIZMO50", // promo_1TrNO9Rq5DJiUm572B1fut6b
};

console.log("Stripe billing setup (test mode) — вече създаден през Stripe CLI.");
console.log("За .env.local ползвай:");
console.log(`  STRIPE_PRICE_STARTER=${TEST_RESOURCES.prices.starter}`);
console.log(`  STRIPE_PRICE_PRO=${TEST_RESOURCES.prices.pro}`);
console.log("  STRIPE_SECRET_KEY=rk_test_...   (RAK от Dashboard — виж коментарите горе)");
console.log("Промо код за -50% първи месец: FRIZMO50");
console.log("\nЗа live mode: пусни командите от коментарите с --live и обнови Vercel env vars.");
