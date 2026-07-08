/**
 * Сийд на тестови продукти за test-magazin-1 — за да се тества ценовия/наличност
 * филтър (S6) с повече от 3 продукта. АДИТИВЕН: пропуска продукт, чийто slug вече
 * съществува (не дублира при повторно пускане). Owner проверка за сигурност.
 *
 * Употреба: node --env-file=.env.local scripts/seed-test-products.mjs
 */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const SHOP_SLUG = "test-magazin-1";
const OWNER_EMAIL = "e.s.kostadinov34@gmail.com";

const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

/* Кирилица → латиница за slug (копие на src/lib/slug.ts, скриптът е самостоятелен). */
const CYR = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s",
  т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht",
  ъ: "a", ь: "y", ю: "yu", я: "ya",
};
const slugify = (s) =>
  s.toLowerCase().split("").map((c) => CYR[c] ?? c).join("")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");

/* Разнообразни цени / наличности / промоции — за да покрият случаите на S6:
   ниска/висока цена, промо цена, изчерпан (0), не следи склад (null). */
const PRODUCTS = [
  { name: "Ленена покривка", cat: "Декорация", price: 3500, promo: null, stock: 8, desc: "Естествен лен, ръчно ушита." },
  { name: "Свещник „Медун“", cat: "Декорация", price: 1800, promo: 1490, stock: 5, desc: "Керамичен свещник с топъл цвят." },
  { name: "Чаша за чай „Липа“", cat: "Чаши", price: 1200, promo: null, stock: 0, desc: "Изчерпана — за тест на наличност." },
  { name: "Комплект чинии (6 бр.)", cat: "Декорация", price: 6800, promo: 5900, stock: null, desc: "Порцелан; не следи наличност." },
  { name: "Купа за плодове", cat: "Декорация", price: 4200, promo: null, stock: 3, desc: "Дълбока керамична купа." },
];

async function main() {
  const [shop] = await sql`select id, name, owner_id from shops where slug = ${SHOP_SLUG}`;
  if (!shop) {
    console.error(`✗ Няма магазин „${SHOP_SLUG}“.`);
    process.exit(1);
  }
  const { data: u, error } = await admin.auth.admin.getUserById(shop.owner_id);
  if (error || u?.user?.email !== OWNER_EMAIL) {
    console.error(`✗ Магазинът не е на ${OWNER_EMAIL} (а на ${u?.user?.email ?? "?"}). Спирам.`);
    process.exit(1);
  }
  console.log(`✓ Магазин: „${shop.name}“ — собственик ${OWNER_EMAIL}`);

  const cats = await sql`select id, name from categories where shop_id = ${shop.id}`;
  const catByName = new Map(cats.map((c) => [c.name, c.id]));

  let added = 0;
  let skipped = 0;
  for (const p of PRODUCTS) {
    const slug = slugify(p.name);
    const [existing] = await sql`
      select id from products where shop_id = ${shop.id} and slug = ${slug}`;
    if (existing) {
      console.log(`  = пропуснат (вече съществува): ${p.name}`);
      skipped++;
      continue;
    }
    const categoryId = catByName.get(p.cat) ?? null;
    await sql`
      insert into products (shop_id, category_id, name, slug, description,
        price_cents, promo_price_cents, images, status, stock, created_at, updated_at)
      values (${shop.id}, ${categoryId}, ${p.name}, ${slug}, ${p.desc},
        ${p.price}, ${p.promo}, ${sql.json([])}, ${"active"}, ${p.stock}, now(), now())`;
    console.log(
      `  + ${p.name} · ${(p.price / 100).toFixed(2)}€${p.promo ? ` (промо ${(p.promo / 100).toFixed(2)}€)` : ""} · склад: ${p.stock ?? "не следи"}`,
    );
    added++;
  }

  console.log(`\n✓ Готово: добавени ${added}, пропуснати ${skipped}.`);
  await sql.end();
}

main().catch(async (e) => {
  console.error("✗ Грешка:", e);
  await sql.end();
  process.exit(1);
});
