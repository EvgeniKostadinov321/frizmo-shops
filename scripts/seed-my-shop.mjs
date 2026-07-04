/**
 * Сийд на ЛИЧНИЯ магазин с продукти и категории (тема „Дрехи и мода").
 * НЕ пипа site_settings (уебсайтът се строи ръчно) и нищо друго по магазина.
 * Идемпотентен: не дублира категория/продукт със същото име/slug.
 *
 * Таргет по slug + проверка на owner email (за да не пише в чужд магазин).
 * Употреба: node scripts/seed-my-shop.mjs
 */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const SHOP_SLUG = "test-magazin-2";
const OWNER_EMAIL = "e.s.kostadinov34@gmail.com";

const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

/** Кирилица → латиница slug (огледало на src/lib/slug.ts). */
const CYR = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
};
const slugify = (s) =>
  s.toLowerCase().split("").map((c) => CYR[c] ?? c).join("")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

const unsplash = (id) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

async function uploadImage(shopId, unsplashId) {
  try {
    const res = await fetch(unsplash(unsplashId));
    if (!res.ok) {
      console.warn(`  ⚠ пропусната снимка ${unsplashId} (${res.status})`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = `shops/${shopId}/products/seed-${unsplashId.slice(0, 13)}.jpg`;
    const { error } = await admin.storage
      .from("shop-media")
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.warn(`  ⚠ upload грешка ${path}: ${error.message}`);
      return null;
    }
    return path;
  } catch (e) {
    console.warn(`  ⚠ ${unsplashId}: ${e.message}`);
    return null;
  }
}

/* Категории: корен + подкатегории */
const CATEGORIES = [
  { name: "Дрехи", children: ["Тениски", "Ризи", "Якета", "Рокли"] },
  { name: "Обувки", children: ["Кецове", "Ботуши"] },
  { name: "Аксесоари", children: ["Чанти", "Шапки"] },
];

/* ~12 продукта. price/promo в евроцентове. img = Unsplash photo id. */
const PRODUCTS = [
  { name: "Класическа бяла тениска", cat: "Тениски", price: 2900, stock: 40, img: "1521572163474-6864f9cf17ab",
    attrs: [["Материал", "100% памук"], ["Кройка", "Regular fit"]] },
  { name: "Оувърсайз тениска графит", cat: "Тениски", price: 3400, promo: 2700, stock: 25, img: "1583743814966-8936f5b7be1a",
    attrs: [["Материал", "Органичен памук"], ["Кройка", "Oversize"]] },
  { name: "Ленена риза бежова", cat: "Ризи", price: 6900, stock: 18, img: "1596755094514-f87e34085b2c",
    attrs: [["Материал", "Лен"], ["Сезон", "Пролет/Лято"]] },
  { name: "Дънкова риза", cat: "Ризи", price: 7500, stock: 15, img: "1602810318383-e386cc2a3ccf",
    attrs: [["Материал", "Деним"], ["Кройка", "Slim"]] },
  { name: "Кожено яке черно", cat: "Якета", price: 18900, promo: 15900, stock: 8, img: "1551028719-00167b16eac5",
    attrs: [["Материал", "Еко кожа"], ["Хастар", "Полиестер"]] },
  { name: "Пухено яке зимно", cat: "Якета", price: 22900, stock: 10, img: "1544923246-77307dd654cb",
    attrs: [["Сезон", "Зима"], ["Пълнеж", "Синтетичен пух"]] },
  { name: "Лятна рокля на цветя", cat: "Рокли", price: 8900, stock: 20, img: "1595777457583-95e059d581b8",
    attrs: [["Материал", "Вискоза"], ["Дължина", "Миди"]] },
  { name: "Елегантна черна рокля", cat: "Рокли", price: 11900, promo: 9900, stock: 12, img: "1566174053879-31528523f8ae",
    attrs: [["Материал", "Полиестер"], ["Повод", "Официален"]] },
  { name: "Бели кожени кецове", cat: "Кецове", price: 9900, stock: 30, img: "1600185365483-26d7a4cc7519",
    attrs: [["Материал", "Естествена кожа"], ["Ходило", "Гумено"]] },
  { name: "Кожени ботуши кафяви", cat: "Ботуши", price: 15900, stock: 14, img: "1608256246200-53e635b5b65f",
    attrs: [["Материал", "Естествена кожа"], ["Сезон", "Есен/Зима"]] },
  { name: "Кожена чанта през рамо", cat: "Чанти", price: 12900, promo: 10500, stock: 16, img: "1590874103328-eac38a683ce7",
    attrs: [["Материал", "Естествена кожа"], ["Закопчаване", "Цип"]] },
  { name: "Плетена зимна шапка", cat: "Шапки", price: 3200, stock: 35, img: "1576871337622-98d48d1cf531",
    attrs: [["Материал", "Мерино вълна"], ["Сезон", "Зима"]] },
];

async function main() {
  /* 1. Намери магазина + провери собственика (email-ът е в auth.users, не в profiles) */
  const [shop] = await sql`
    select id, name, slug, owner_id from shops where slug = ${SHOP_SLUG}`;

  if (!shop) {
    console.error(`✗ Няма магазин със slug "${SHOP_SLUG}".`);
    process.exit(1);
  }
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(shop.owner_id);
  const ownerEmail = userData?.user?.email;
  if (userErr || !ownerEmail) {
    console.error(`✗ Не мога да проверя собственика: ${userErr?.message ?? "няма email"}. Спирам.`);
    process.exit(1);
  }
  if (ownerEmail !== OWNER_EMAIL) {
    console.error(`✗ Магазинът "${shop.name}" е на ${ownerEmail}, не на ${OWNER_EMAIL}. Спирам.`);
    process.exit(1);
  }
  console.log(`✓ Магазин: „${shop.name}" (${shop.slug}) — собственик ${ownerEmail}`);

  const shopId = shop.id;

  /* 2. Категории (идемпотентно по име) */
  const catIds = {};
  const existing = await sql`select id, name from categories where shop_id = ${shopId}`;
  for (const c of existing) catIds[c.name] = c.id;

  let order = 1;
  for (const cat of CATEGORIES) {
    if (!catIds[cat.name]) {
      const [root] = await sql`insert into categories (shop_id, name, sort_order)
        values (${shopId}, ${cat.name}, ${order}) returning id`;
      catIds[cat.name] = root.id;
      console.log(`  + категория: ${cat.name}`);
    }
    order++;
    let childOrder = 1;
    for (const child of cat.children) {
      if (!catIds[child]) {
        const [c] = await sql`insert into categories (shop_id, parent_id, name, sort_order)
          values (${shopId}, ${catIds[cat.name]}, ${child}, ${childOrder}) returning id`;
        catIds[child] = c.id;
        console.log(`    + подкатегория: ${child}`);
      }
      childOrder++;
    }
  }

  /* 3. Продукти (идемпотентно по slug) */
  const existingSlugs = new Set(
    (await sql`select slug from products where shop_id = ${shopId}`).map((r) => r.slug),
  );

  let added = 0;
  for (const p of PRODUCTS) {
    const slug = slugify(p.name);
    if (existingSlugs.has(slug)) {
      console.log(`  = продукт вече съществува: ${p.name}`);
      continue;
    }
    const imgPath = await uploadImage(shopId, p.img);
    const description = p.attrs.map(([k, v]) => `${k}: ${v}`).join(". ") + ".";
    const [prod] = await sql`
      insert into products (shop_id, category_id, name, slug, description, price_cents,
        promo_price_cents, images, status, stock)
      values (${shopId}, ${catIds[p.cat] ?? null}, ${p.name}, ${slug}, ${description},
        ${p.price}, ${p.promo ?? null}, ${sql.json(imgPath ? [imgPath] : [])}, 'active', ${p.stock})
      returning id`;
    for (const [i, [name, value]] of p.attrs.entries()) {
      await sql`insert into product_attributes (product_id, name, value, sort_order)
        values (${prod.id}, ${name}, ${value}, ${i})`;
    }
    added++;
    console.log(`  + продукт: ${p.name}${p.promo ? " (промо)" : ""}`);
  }

  console.log(`\n✓ Готово: ${added} нови продукта, ${Object.keys(catIds).length} категории общо.`);
  await sql.end();
}

main().catch(async (e) => {
  console.error("✗ Грешка:", e);
  await sql.end();
  process.exit(1);
});
