/**
 * E2E верификация на билинг потока срещу РЕАЛНИЯ Stripe test API + dev база.
 * Симулира целия цикъл БЕЗ браузър: Customer → SetupIntent → карта (test PM) →
 * фактура (charge_automatically) → плащане → проверка на статуса.
 *
 * Пусни: node --env-file=.env.local scripts/verify-billing-e2e.mjs
 * Изисква: STRIPE_SECRET_KEY (sk_test_), DATABASE_URL_MIGRATIONS.
 */
import Stripe from "stripe";
import postgres from "postgres";

const sk = process.env.STRIPE_SECRET_KEY;
if (!sk?.startsWith("sk_test")) {
  console.error("✗ Трябва sk_test_ ключ (test mode). Намерен:", sk?.slice(0, 8));
  process.exit(1);
}
const stripe = new Stripe(sk, { apiVersion: "2026-06-24.dahlia" });
const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  let customerId, invoiceId;
  try {
    // ---- 1. ensureStripeCustomer поведение: създай Customer ----
    const customer = await stripe.customers.create({
      email: "e2e-fee@example.com",
      name: "__fee_e2e__",
      metadata: { app: "frizmo-shops", shopId: "e2e-test" },
    });
    customerId = customer.id;
    check("Customer създаден с metadata.app=frizmo-shops", customer.metadata.app === "frizmo-shops", customerId);

    // ---- 2. SetupIntent (Task 7 card flow) ----
    const si = await stripe.setupIntents.create({ customer: customerId, usage: "off_session" });
    check("SetupIntent създаден (off_session)", Boolean(si.client_secret), si.id);

    // ---- 3. Прикачи test карта (4242...) + направи я default (симулира confirmSetup) ----
    const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pm.id },
    });
    // customerHasDefaultCard логиката:
    const refreshed = await stripe.customers.retrieve(customerId);
    check("customerHasDefaultCard → true след запазена карта",
      Boolean(refreshed.invoice_settings?.default_payment_method), pm.id);

    // ---- 4. Издай фактура (Task 8 ред: draft invoice → invoiceItem с invoice:id) ----
    /* Точно както bill-fees route.ts: draft ПЪРВО, после item с явен invoice:id.
       auto_advance:false тук, за да контролираме плащането детерминистично в теста. */
    const inv = await stripe.invoices.create({
      customer: customerId,
      collection_method: "charge_automatically",
      auto_advance: false,
      metadata: { app: "frizmo-shops", feeInvoiceId: "e2e-fake-id" },
    });
    invoiceId = inv.id;
    await stripe.invoiceItems.create({
      customer: customerId, invoice: invoiceId, amount: 105, currency: "eur",
      description: "Такса за продажби (e2e)",
    });
    const withItem = await stripe.invoices.retrieve(invoiceId);
    check("Фактура събира invoiceItem (amount_due=105) — правилен ред за new API",
      withItem.amount_due === 105, `${invoiceId} · due=${withItem.amount_due}ct`);
    check("collection_method=charge_automatically", withItem.collection_method === "charge_automatically");

    // ---- 5. Финализирай + плати (авто-теглене от запазената карта) ----
    await stripe.invoices.finalizeInvoice(invoiceId);
    const paid = await stripe.invoices.pay(invoiceId);
    check("Фактурата се плаща авто от запазената карта (status=paid)", paid.status === "paid", `status=${paid.status}`);
    check("Платената сума = 105 ct (1.05 €)", paid.amount_paid === 105, `paid=${paid.amount_paid}`);
    check("metadata.feeInvoiceId се пренася (за webhook рутиране)", paid.metadata?.feeInvoiceId === "e2e-fake-id");
  } finally {
    // Чистим Stripe test обектите (test mode → безопасно).
    if (customerId) { try { await stripe.customers.del(customerId); } catch {} }
  }

  await sql.end();
  console.log(failures === 0 ? "\n✓ Билинг E2E потокът работи (Stripe test)." : `\n✗ ${failures} проверки се провалиха.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("✗ Грешка:", e.message);
  await sql.end();
  process.exit(1);
});
