/**
 * Сийд на демо съдържание за магазин „Дрехи и мода":
 * категории, продукти с варианти/промоции и пълен набор секции за уебсайта.
 * Снимките са безплатни от Unsplash, качват се в нашия Storage.
 *
 * Употреба:  SEED_SHOP_ID=<uuid> node scripts/seed-demo.mjs
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const SHOP_ID = process.env.SEED_SHOP_ID;
if (!SHOP_ID) throw new Error("Задай SEED_SHOP_ID");

const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const unsplash = (id) =>
  `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

async function uploadImage(unsplashId, folder) {
  const res = await fetch(unsplash(unsplashId));
  if (!res.ok) throw new Error(`Unsplash ${unsplashId}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const path = `shops/${SHOP_ID}/${folder}/seed-${unsplashId.slice(0, 13)}.jpg`;
  const { error } = await admin.storage
    .from("shop-media")
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  console.log("  ↑", path);
  return path;
}

/* ── 1. Снимки ─────────────────────────────────────────────── */
console.log("Качване на снимки...");
const img = {};
const productImages = {
  whiteTee: "1521572163474-6864f9cf17ab",
  printTee: "1576566588028-4147f3842f27",
  shirt: "1596755094514-f87e34085b2c",
  jacket: "1591047139829-d91aecb6caea",
  jeans: "1542272604-787c3835535d",
  bag: "1584917865442-de89df76afd3",
  backpack: "1553062407-98eeb64c6a62",
  watch: "1523275335684-37898b6baf30",
  dress: "1595777457583-95e059d581b8",
  grayTee: "1583743814966-8936f5b7be1a",
};
const siteImages = {
  hero: "1620799140408-edc6dcb6d633",
  imageText: "1434389677669-e08b4cac3105",
  promo: "1608234807905-4466023792f5",
  about1: "1551028719-00167b16eac5",
  about2: "1594633312681-425c7b97ccd1",
};
for (const [key, id] of Object.entries(productImages)) img[key] = await uploadImage(id, "products");
for (const [key, id] of Object.entries(siteImages)) img[key] = await uploadImage(id, "site");

/* ── 2. Категории ──────────────────────────────────────────── */
console.log("Категории...");
async function ensureCategory(name, parentId = null) {
  const existing = await sql`
    select id from categories where shop_id = ${SHOP_ID} and name = ${name} limit 1`;
  if (existing.length > 0) return existing[0].id;
  const [{ max }] = await sql`
    select coalesce(max(sort_order), 0) as max from categories
    where shop_id = ${SHOP_ID} and parent_id is not distinct from ${parentId}`;
  const [row] = await sql`
    insert into categories (shop_id, parent_id, name, sort_order)
    values (${SHOP_ID}, ${parentId}, ${name}, ${Number(max) + 1}) returning id`;
  return row.id;
}

const catMen = await ensureCategory("Мъжки дрехи");
const catWomen = await ensureCategory("Дамски дрехи");
const catAcc = await ensureCategory("Аксесоари");
const catTees = await ensureCategory("Тениски", catMen);
const catShirts = await ensureCategory("Ризи", catMen);
const catDresses = await ensureCategory("Рокли", catWomen);

/* ── 3. Продукти ───────────────────────────────────────────── */
console.log("Продукти...");
const sizeAxis = (values) => ({ name: "Размер", values });
const sizedVariants = (values, overrides = {}) =>
  values.map((v) => ({
    options: { Размер: v },
    priceCents: overrides[v]?.price ?? null,
    stock: overrides[v]?.stock ?? null,
  }));

const PRODUCTS = [
  {
    name: "Бяла тениска Basic", slug: "byala-teniska-basic", categoryId: catTees,
    priceCents: 2490, promoPriceCents: 1990, images: [img.whiteTee], stock: null,
    description: "Класическа бяла тениска от 100% органичен памук.\n\nМека, дишаща и удобна — основата на всеки гардероб.",
    attributes: [["Материя", "100% органичен памук"], ["Произход", "България"], ["Грижа", "Пране на 30°"]],
    options: [sizeAxis(["S", "M", "L", "XL"])],
    variants: sizedVariants(["S", "M", "L", "XL"], { XL: { price: 2690 } }),
  },
  {
    name: "Тениска с щампа Urban", slug: "teniska-s-shtampa-urban", categoryId: catTees,
    priceCents: 2990, promoPriceCents: null, images: [img.printTee], stock: null,
    description: "Тениска с авторска щампа — печат, който не се напуква след пране.",
    attributes: [["Материя", "95% памук, 5% еластан"]],
    options: [sizeAxis(["S", "M", "L"])],
    variants: sizedVariants(["S", "M", "L"]),
  },
  {
    name: "Сива тениска Oversize", slug: "siva-teniska-oversize", categoryId: catTees,
    priceCents: 2790, promoPriceCents: null, images: [img.grayTee], stock: null,
    description: "Свободна кройка за небрежна елегантност.",
    attributes: [["Материя", "100% памук"], ["Кройка", "Oversize"]],
    options: [sizeAxis(["M", "L"])],
    variants: sizedVariants(["M", "L"]),
  },
  {
    name: "Карирана риза Casual", slug: "karirana-riza-casual", categoryId: catShirts,
    priceCents: 5490, promoPriceCents: null, images: [img.shirt], stock: null,
    description: "Мека карирана риза за всекидневието — носи се и разкопчана върху тениска.",
    attributes: [["Материя", "Памук фланела"]],
    options: [sizeAxis(["M", "L", "XL"])],
    variants: sizedVariants(["M", "L", "XL"]),
  },
  {
    name: "Есенно яке Explorer", slug: "esenno-yake-explorer", categoryId: catMen,
    priceCents: 12900, promoPriceCents: 9900, images: [img.jacket], stock: 8,
    description: "Ветроустойчиво яке с подплата — за преходните сезони.\n\nДжобове с цип и регулируема качулка.",
    attributes: [["Материя", "Полиестер с подплата"], ["Сезон", "Пролет/Есен"]],
    options: [], variants: [],
  },
  {
    name: "Дънки Slim Fit", slug: "dunki-slim-fit", categoryId: catMen,
    priceCents: 7990, promoPriceCents: null, images: [img.jeans], stock: null,
    description: "Класически сини дънки с лека еластичност за удобство.",
    attributes: [["Материя", "98% памук, 2% еластан"]],
    options: [{ name: "Размер", values: ["30", "32", "34", "36"] }],
    variants: sizedVariants(["30", "32", "34", "36"]),
  },
  {
    name: "Лятна рокля на цветя", slug: "lyatna-roklya-na-tsvetya", categoryId: catDresses,
    priceCents: 6990, promoPriceCents: 5490, images: [img.dress], stock: null,
    description: "Лека вискозна рокля с флорален десен — идеална за топлите дни.",
    attributes: [["Материя", "100% вискоза"], ["Дължина", "Миди"]],
    options: [sizeAxis(["XS", "S", "M", "L"])],
    variants: sizedVariants(["XS", "S", "M", "L"]),
  },
  {
    name: "Кожена чанта Milano", slug: "kozhena-chanta-milano", categoryId: catAcc,
    priceCents: 14900, promoPriceCents: null, images: [img.bag], stock: 3,
    description: "Ръчно изработена чанта от естествена кожа. Става по-красива с времето.",
    attributes: [["Материал", "Естествена кожа"], ["Изработка", "Ръчна"]],
    options: [], variants: [],
  },
  {
    name: "Градска раница Metro", slug: "gradska-ranitsa-metro", categoryId: catAcc,
    priceCents: 8990, promoPriceCents: null, images: [img.backpack], stock: 12,
    description: "Раница с отделение за лаптоп 15\" и скрит джоб против кражба.",
    attributes: [["Обем", "22 л"], ["Лаптоп", "до 15,6\""]],
    options: [], variants: [],
  },
  {
    name: "Класически часовник Heritage", slug: "klasicheski-chasovnik-heritage", categoryId: catAcc,
    priceCents: 19900, promoPriceCents: null, images: [img.watch], stock: 5,
    description: "Минималистичен часовник с кожена каишка — завършекът на всеки тоалет.",
    attributes: [["Механизъм", "Кварцов"], ["Каишка", "Естествена кожа"]],
    options: [], variants: [],
  },
];

for (const p of PRODUCTS) {
  const existing = await sql`
    select id from products where shop_id = ${SHOP_ID} and slug = ${p.slug} limit 1`;
  if (existing.length > 0) {
    console.log("  =", p.name, "(вече съществува)");
    continue;
  }
  const [row] = await sql`
    insert into products (shop_id, category_id, name, slug, description, price_cents,
      promo_price_cents, images, status, stock)
    values (${SHOP_ID}, ${p.categoryId}, ${p.name}, ${p.slug}, ${p.description},
      ${p.priceCents}, ${p.promoPriceCents}, ${sql.json(p.images)}, 'active', ${p.stock})
    returning id`;
  const productId = row.id;

  for (const [i, [name, value]] of p.attributes.entries()) {
    await sql`insert into product_attributes (product_id, name, value, sort_order)
      values (${productId}, ${name}, ${value}, ${i})`;
  }
  for (const [i, opt] of p.options.entries()) {
    await sql`insert into product_options (product_id, name, values, sort_order)
      values (${productId}, ${opt.name}, ${sql.json(opt.values)}, ${i})`;
  }
  for (const v of p.variants) {
    await sql`insert into product_variants (product_id, options, price_cents, stock, image_paths)
      values (${productId}, ${sql.json(v.options)}, ${v.priceCents}, ${v.stock}, ${sql.json([])})`;
  }
  console.log("  +", p.name);
}

/* ── 4. Настройки на уебсайта ──────────────────────────────── */
console.log("Уебсайт настройки...");
const section = (type, data) => ({ id: randomUUID(), type, enabled: true, data });

const settings = {
  theme: "classic",
  primaryColor: "#1f2937",
  accentColor: "#d97706",
  headerLayout: "logo-left",
  footerText: "Бутиков магазин за дрехи и аксесоари с внимание към детайла.",
  aboutText:
    "тест-магазин-1 започна като малко ателие с една шевна машина и голяма любов към качествените материи.\n\nДнес подбираме всяко парче в колекцията лично — дрехи, които се носят с години, а не един сезон.\n\nВярваме в бавната мода: по-малко, но по-добри неща.",
  aboutImagePaths: [img.about1, img.about2],
  sections: [
    section("announcement", { text: "Безплатна доставка над 60 € · Връщане до 14 дни", href: "" }),
    section("hero", {
      layout: "split",
      title: "Стил за всеки ден",
      subtitle: "Внимателно подбрани дрехи и аксесоари, които се носят с години.",
      ctaLabel: "Разгледай колекцията",
      ctaHref: "",
      imagePaths: [img.hero],
    }),
    section("trust-badges", {
      items: [
        { icon: "truck", text: "Доставка до 2 работни дни" },
        { icon: "return", text: "Връщане до 14 дни" },
        { icon: "shield", text: "Сигурно пазаруване" },
      ],
    }),
    section("featured-products", { title: "Новите попълнения", mode: "newest", productIds: [] }),
    section("category-grid", { title: "Пазарувай по категория", categoryIds: [] }),
    section("image-text", {
      title: "Качество, което се усеща",
      text: "Всяка материя минава през ръцете ни, преди да стигне до теб.\n\nРаботим с малки серии и проверени производители — затова дрехите ни изглеждат добре и след петдесетото пране.",
      imagePath: img.imageText,
      imageSide: "left",
    }),
    section("promo-banner", {
      title: "−20% на летните тениски",
      text: "Само до края на месеца — обнови гардероба си за лятото.",
      ctaLabel: "Виж промоциите",
      ctaHref: "",
      imagePath: img.promo,
    }),
    section("testimonials", {
      title: "Какво казват клиентите",
      items: [
        { name: "Мария И.", text: "Роклята е още по-красива на живо. Бърза доставка и страхотна комуникация!" },
        { name: "Георги Д.", text: "Тениските са с невероятно качество за тази цена. Втора поръчка за месец." },
        { name: "Елена П.", text: "Чантата Milano е точно каквато я търсих от години. Препоръчвам горещо." },
      ],
    }),
    section("faq", {
      title: "Често задавани въпроси",
      items: [
        { question: "Как да избера правилния размер?", answer: "Всеки продукт има таблица с размери в характеристиките. Ако се колебаеш между два размера, вземи по-големия — или ни пиши." },
        { question: "Колко струва доставката?", answer: "5 € с куриер до адрес или офис. Безплатна за поръчки над 60 €." },
        { question: "Мога ли да върна продукт?", answer: "Да, до 14 дни от получаването, стига да е в оригинален вид с етикетите." },
        { question: "Кога ще получа поръчката си?", answer: "Изпращаме до 24 часа в работни дни; доставката отнема 1–2 работни дни." },
      ],
    }),
    section("gallery", {
      title: "От нашия свят",
      imagePaths: [img.hero, img.imageText, img.about1, img.about2],
    }),
    section("socials", { title: "Последвай ни" }),
    section("contact-map", { title: "Къде да ни намериш", showMap: true }),
  ],
};

await sql`
  insert into site_settings (shop_id, settings, draft)
  values (${SHOP_ID}, ${sql.json(settings)}, null)
  on conflict (shop_id) do update set settings = ${sql.json(settings)}, draft = null, updated_at = now()`;

const [counts] = await sql`
  select
    (select count(*) from products where shop_id = ${SHOP_ID}) as products,
    (select count(*) from categories where shop_id = ${SHOP_ID}) as categories`;
console.log(`Готово: ${counts.products} продукта, ${counts.categories} категории.`);
await sql.end();
