/**
 * Сийд на 3-те демо магазина (витрината на landing-а + пълнеж за каталога).
 * Създава реални акаунти (demo+{ниша}@frizmoshops.bg, random парола),
 * published магазини, категории, продукти и уебсайт настройки.
 * Идемпотентен: ниша със съществуващ slug се пропуска.
 *
 * Употреба: node scripts/seed-demo-shops.mjs (среда от .env.local)
 */
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const unsplash = (id) =>
  `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

/** Качва снимка; при 404 връща null (продуктът остава без снимка, сийдът не пада). */
async function uploadImage(shopId, unsplashId, folder) {
  try {
    const res = await fetch(unsplash(unsplashId));
    if (!res.ok) {
      console.warn(`  ⚠ пропусната снимка ${unsplashId} (${res.status})`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = `shops/${shopId}/${folder}/seed-${unsplashId.slice(0, 13)}.jpg`;
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

const section = (type, data) => ({ id: randomUUID(), type, enabled: true, data });

const NICHES = [
  {
    slug: "ferma-zelena-dolina",
    email: "demo+ferma@frizmoshops.bg",
    shop: {
      name: "Ферма Зелена долина",
      businessCategory: "Храни и напитки",
      description:
        "Семейна ферма в подножието на Стара планина. Мляко, сирене и яйца от щастливи животни — директно от нас до твоята трапеза.",
      city: "Троян",
      phone: "+359888100001",
      email: "demo+ferma@frizmoshops.bg",
    },
    theme: { theme: "warm", primaryColor: "#5c7c3f", accentColor: "#c98a1b" },
    heroImage: "1500595046743-cd271d694d30",
    categories: [
      { name: "Млечни продукти", children: ["Сирена", "Кисело мляко"] },
      { name: "От двора", children: [] },
    ],
    products: [
      { name: "Краве сирене — саламурено", slug: "krave-sirene", price: 1590, promo: null, img: "1486297678162-eb2a19b0a32d", cat: "Сирена", stock: null, attrs: [["Мляко", "Краве, непастьоризирано"], ["Зреене", "45 дни"]], deal: { quantity: 2, total: 2800 } },
      { name: "Домашно кисело мляко 3.6%", slug: "kiselo-mlyako", price: 320, promo: null, img: "1550583724-b2692b85b150", cat: "Кисело мляко", stock: 20, attrs: [["Масленост", "3.6%"]], deal: null },
      { name: "Фермерски яйца (10 бр)", slug: "fermerski-yaytsa", price: 650, promo: 550, img: "1582722872445-44dc5f7e3c8f", cat: "От двора", stock: 15, attrs: [["Клас", "L"], ["Отглеждане", "Свободно"]], deal: null },
      { name: "Пчелен мед — липов", slug: "pchelen-med-lipov", price: 1490, promo: null, img: "1587049352846-4a222e784d38", cat: "От двора", stock: 8, attrs: [["Реколта", "2026"], ["Буркан", "720 мл"]], deal: null },
      { name: "Домашен козунак", slug: "domashen-kozunak", price: 1250, promo: null, img: "1509440159596-0249088772ff", cat: "От двора", stock: 5, attrs: [["Тегло", "600 г"]], deal: null },
    ],
    imageText: {
      title: "От нашата ферма до твоята маса",
      text: "Всяка сутрин доим, точим и опаковаме на ръка.\n\nБез консерванти, без посредници — само истински вкус от Балкана.",
      img: "1500595046743-cd271d694d30",
    },
    faq: [
      { question: "Как доставяте млечните продукти?", answer: "В хладилни чанти с куриер до 24 часа или взимане от фермата." },
      { question: "Продуктите сертифицирани ли са?", answer: "Да, фермата е регистрирана по всички изисквания на БАБХ." },
    ],
  },
  {
    slug: "atelie-rachichka",
    email: "demo+atelie@frizmoshops.bg",
    shop: {
      name: "Ателие Ръчичка",
      businessCategory: "Ръчна изработка",
      description:
        "Керамика, свещи и плетива, направени на ръка с много любов. Всяко парче е единствено — като хората, за които е предназначено.",
      city: "Пловдив",
      phone: "+359888100002",
      email: "demo+atelie@frizmoshops.bg",
    },
    theme: { theme: "classic", primaryColor: "#8a4f3d", accentColor: "#3d6b8a" },
    heroImage: "1565193566173-7a0ee3dbe261",
    categories: [
      { name: "Керамика", children: [] },
      { name: "Свещи и ароматия", children: [] },
      { name: "Плетива", children: [] },
    ],
    products: [
      { name: "Керамична чаша „Утро“", slug: "keramichna-chasha-utro", price: 2800, promo: null, img: "1565193566173-7a0ee3dbe261", cat: "Керамика", stock: 6, attrs: [["Обем", "350 мл"], ["Глазура", "Безоловна"]], deal: { quantity: 2, total: 5000 } },
      { name: "Соева свещ — лавандула", slug: "soeva-svesht-lavandula", price: 1800, promo: 1500, img: "1602874801007-bd458bb1b8b6", cat: "Свещи и ароматия", stock: 12, attrs: [["Восък", "100% соев"], ["Горене", "~40 часа"]], deal: null },
      { name: "Плетен шал от мерино", slug: "pleten-shal-merino", price: 6500, promo: null, img: "1520903920243-00d872a2d1c9", cat: "Плетива", stock: 3, attrs: [["Прежда", "100% мерино"], ["Изработка", "2 дни плетене"]], deal: null },
      { name: "Керамична купа за салата", slug: "keramichna-kupa", price: 4200, promo: null, img: "1493106641515-6b5631de4bb9", cat: "Керамика", stock: 4, attrs: [["Диаметър", "24 см"]], deal: null },
      { name: "Ръчен сапун с козе мляко", slug: "rachen-sapun", price: 900, promo: null, img: "1600857544200-b2f666a9a2ec", cat: "Свещи и ароматия", stock: 25, attrs: [["Тегло", "110 г"]], deal: { quantity: 3, total: 2200 } },
    ],
    imageText: {
      title: "Направено на ръка, с история",
      text: "Зад всяко изделие стоят часове труд и една чаша изстинало кафе.\n\nРаботим с естествени материали и малки серии — когато нещо свърши, идва ново, но никога същото.",
      img: "1452860606245-08befc0ff44b",
    },
    faq: [
      { question: "Мога ли да поръчам персонализация?", answer: "Да! Пиши ни бележка към поръчката — надпис, цвят или размер по желание." },
      { question: "Колко време отнема изработката?", answer: "Наличните продукти пътуват до 2 дни; по поръчка — до 2 седмици." },
    ],
  },
  {
    slug: "glow-kozmetika",
    email: "demo+glow@frizmoshops.bg",
    shop: {
      name: "Глоу Козметика",
      businessCategory: "Козметика",
      description:
        "Натурална козметика с българска роза и лавандула. Малки партиди, чисти съставки, видими резултати.",
      city: "София",
      phone: "+359888100003",
      email: "demo+glow@frizmoshops.bg",
    },
    theme: { theme: "modern", primaryColor: "#b0486e", accentColor: "#4a7a6f" },
    heroImage: "1556228720-195a672e8a03",
    categories: [
      { name: "Грижа за лице", children: [] },
      { name: "Грижа за тяло", children: [] },
    ],
    products: [
      { name: "Крем за лице с розово масло", slug: "krem-za-litse-roza", price: 3400, promo: 2900, img: "1556228720-195a672e8a03", cat: "Грижа за лице", stock: 18, attrs: [["Обем", "50 мл"], ["Съставки", "Роза Дамасцена, ший, витамин Е"]], deal: null },
      { name: "Серум с хиалурон", slug: "serum-hialuron", price: 4200, promo: null, img: "1571781926291-c477ebfd024b", cat: "Грижа за лице", stock: 10, attrs: [["Обем", "30 мл"]], deal: null },
      { name: "Лавандулово масло за тяло", slug: "lavandulovo-maslo", price: 2600, promo: null, img: "1570172619644-dfd03ed5d881", cat: "Грижа за тяло", stock: 14, attrs: [["Обем", "100 мл"], ["Произход", "Казанлък"]], deal: { quantity: 2, total: 4500 } },
      { name: "Скраб с кафе и какао", slug: "skrab-kafe-kakao", price: 1900, promo: null, img: "1608248543803-ba4f8c70ae0b", cat: "Грижа за тяло", stock: 22, attrs: [["Тегло", "200 г"]], deal: null },
    ],
    imageText: {
      title: "Чисти съставки, честни етикети",
      text: "Всичко, което слагаме в бурканчето, можеш да прочетеш и разбереш.\n\nБез парабени, без силикони, без компромиси — тествано върху нас, не върху животни.",
      img: "1596462502278-27bfdc403348",
    },
    faq: [
      { question: "Подходящи ли са за чувствителна кожа?", answer: "Да — формулите са хипоалергенни. При съмнение направи тест на малък участък." },
      { question: "Какъв е срокът на годност?", answer: "6–12 месеца от отваряне (отбелязан на всеки продукт)." },
    ],
  },
];

for (const niche of NICHES) {
  const existing = await sql`select id from shops where slug = ${niche.slug} limit 1`;
  if (existing.length > 0) {
    console.log(`= ${niche.shop.name} (вече съществува)`);
    continue;
  }
  console.log(`+ ${niche.shop.name}`);

  /* Акаунт */
  const password = randomBytes(24).toString("base64url");
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: niche.email,
    password,
    email_confirm: true,
  });
  let userId = userData?.user?.id;
  if (userError) {
    /* Вече съществува → намираме го */
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email === niche.email)?.id;
    if (!userId) throw userError;
  }
  await sql`insert into profiles (id, full_name) values (${userId}, ${niche.shop.name})
    on conflict (id) do nothing`;

  /* Магазин (published) */
  const [shopRow] = await sql`
    insert into shops (owner_id, name, slug, description, business_category, city, phone, email, status, working_hours, social_links)
    values (${userId}, ${niche.shop.name}, ${niche.slug}, ${niche.shop.description},
      ${niche.shop.businessCategory}, ${niche.shop.city}, ${niche.shop.phone},
      ${niche.shop.email}, 'published',
      ${sql.json({ days: [0, 1, 2, 3, 4].map(() => ({ closed: false, open: "09:00", close: "18:00" })).concat([{ closed: true, open: "09:00", close: "18:00" }, { closed: true, open: "09:00", close: "18:00" }]) })},
      ${sql.json({ facebook: "", instagram: "" })})
    returning id`;
  const shopId = shopRow.id;

  /* Fulfillment дефолти */
  await sql`insert into shipping_methods (shop_id, type, name, price_cents, free_over_cents)
    values (${shopId}, 'courier', 'Куриер до адрес', 500, 6000)`;
  await sql`insert into payment_methods (shop_id, type, name, details)
    values (${shopId}, 'cod', 'Наложен платеж', 'Плащаш на куриера при получаване.')`;

  /* Категории */
  const catIds = {};
  let order = 1;
  for (const cat of niche.categories) {
    const [root] = await sql`insert into categories (shop_id, name, sort_order)
      values (${shopId}, ${cat.name}, ${order++}) returning id`;
    catIds[cat.name] = root.id;
    let childOrder = 1;
    for (const child of cat.children) {
      const [c] = await sql`insert into categories (shop_id, parent_id, name, sort_order)
        values (${shopId}, ${root.id}, ${child}, ${childOrder++}) returning id`;
      catIds[child] = c.id;
    }
  }

  /* Продукти */
  for (const p of niche.products) {
    const imgPath = await uploadImage(shopId, p.img, "products");
    const [prod] = await sql`
      insert into products (shop_id, category_id, name, slug, description, price_cents,
        promo_price_cents, images, status, stock)
      values (${shopId}, ${catIds[p.cat] ?? null}, ${p.name}, ${p.slug},
        ${p.attrs.map(([k, v]) => `${k}: ${v}`).join(". ") + "."},
        ${p.price}, ${p.promo}, ${sql.json(imgPath ? [imgPath] : [])}, 'active', ${p.stock})
      returning id`;
    for (const [i, [name, value]] of p.attrs.entries()) {
      await sql`insert into product_attributes (product_id, name, value, sort_order)
        values (${prod.id}, ${name}, ${value}, ${i})`;
    }
    if (p.deal) {
      await sql`insert into promotions (shop_id, product_id, quantity, total_price_cents)
        values (${shopId}, ${prod.id}, ${p.deal.quantity}, ${p.deal.total})`;
    }
  }

  /* Уебсайт настройки */
  const heroPath = await uploadImage(shopId, niche.heroImage, "site");
  const imageTextPath = await uploadImage(shopId, niche.imageText.img, "site");
  const settings = {
    ...niche.theme,
    headerLayout: "logo-left",
    footerText: niche.shop.description.split(".")[0] + ".",
    aboutText: niche.imageText.text,
    aboutImagePaths: imageTextPath ? [imageTextPath] : [],
    sections: [
      section("hero", {
        layout: "split",
        title: niche.shop.name,
        subtitle: niche.shop.description.split(".")[0] + ".",
        ctaLabel: "Разгледай продуктите",
        ctaHref: "",
        imagePaths: heroPath ? [heroPath] : [],
      }),
      section("trust-badges", {
        items: [
          { icon: "truck", text: "Бърза доставка" },
          { icon: "return", text: "Връщане до 14 дни" },
          { icon: "leaf", text: "Направено в България" },
        ],
      }),
      section("featured-products", { title: "Нашите продукти", mode: "newest", productIds: [] }),
      section("image-text", {
        title: niche.imageText.title,
        text: niche.imageText.text,
        imagePath: imageTextPath ?? "",
        imageSide: "left",
      }),
      section("faq", { title: "Често задавани въпроси", items: niche.faq }),
      section("contact-map", { title: "Къде да ни намериш", showMap: true }),
    ],
  };
  await sql`insert into site_settings (shop_id, settings) values (${shopId}, ${sql.json(settings)})
    on conflict (shop_id) do update set settings = ${sql.json(settings)}, updated_at = now()`;
}

const [counts] = await sql`
  select count(*) as shops from shops where status = 'published'`;
console.log(`Готово. Published магазини общо: ${counts.shops}`);
await sql.end();
