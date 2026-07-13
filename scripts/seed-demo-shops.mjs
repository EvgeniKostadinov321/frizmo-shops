/**
 * Сийд на демо магазините — по ЕДИН магазин за всяка от 9-те storefront теми,
 * всеки с ВСИЧКИ 13 секции попълнени, за да се тества как изглежда всяка тема ×
 * всяка секция. Витрина на landing-а + пълнеж за каталога + ръчно тестване.
 * Създава реални акаунти (demo+{ниша}@frizmoshops.bg, random парола), published
 * магазини, категории, продукти и пълни уебсайт настройки.
 * Идемпотентен: ниша със съществуващ slug се пропуска.
 *
 * Употреба: node --env-file=.env.local scripts/seed-demo-shops.mjs
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
    const path = `shops/${shopId}/${folder}/seed-${unsplashId.slice(0, 13)}-${randomBytes(3).toString("hex")}.jpg`;
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

/**
 * 9 ниши — по една на тема. Всяка noси: магазин, тема (валиден id + палитра
 * пасваща на темата), категории, 5 продукта, и съдържание за всички секции
 * (hero, imageText, promo, testimonials, faq, gallery снимки).
 */
const NICHES = [
  {
    // ТЕМА: atelie (топла светла)
    slug: "atelie-glina",
    email: "demo+atelie@frizmoshops.bg",
    shop: {
      name: "Ателие Глина",
      businessCategory: "Ръчна изработка",
      description:
        "Керамика, оформена на ръка в сърцето на Стария Пловдив. Всяко парче е единствено — като хората, за които е предназначено.",
      city: "Пловдив",
      phone: "+359888100001",
      facebook: "https://facebook.com/atelieglina",
      instagram: "https://instagram.com/atelieglina",
    },
    theme: { theme: "atelie", primaryColor: "#a9642e", accentColor: "#c2410c", headerVariant: 2 },
    heroImage: "1565193566173-7a0ee3dbe261",
    categories: [
      { name: "Керамика", children: ["Чаши", "Купи"] },
      { name: "Свещи", children: [] },
    ],
    products: [
      { name: "Чаша „Утро“", slug: "chasha-utro", price: 2800, promo: null, img: "1565193566173-7a0ee3dbe261", cat: "Чаши", stock: 6, attrs: [["Обем", "350 мл"], ["Глазура", "Безоловна"]], deal: { quantity: 2, total: 5000 } },
      { name: "Купа за салата", slug: "kupa-salata", price: 4200, promo: null, img: "1493106641515-6b5631de4bb9", cat: "Купи", stock: 4, attrs: [["Диаметър", "24 см"]], deal: null },
      { name: "Соева свещ — лавандула", slug: "svesht-lavandula", price: 1800, promo: 1500, img: "1602874801007-bd458bb1b8b6", cat: "Свещи", stock: 12, attrs: [["Восък", "Соев"], ["Горене", "~40 часа"]], deal: null },
      { name: "Чаша за чай с чинийка", slug: "chasha-chiniyka", price: 3400, promo: null, img: "1514228742587-6b1558fcca3d", cat: "Чаши", stock: 5, attrs: [["Обем", "250 мл"]], deal: null },
      { name: "Керамична вазичка", slug: "vazichka", price: 3900, promo: null, img: "1610701596007-11502861dcfa", cat: "Купи", stock: 7, attrs: [["Височина", "18 см"]], deal: { quantity: 2, total: 7000 } },
    ],
    imageText: { title: "Направено на ръка, с история", text: "Зад всяко изделие стоят часове труд и една чаша изстинало кафе.\n\nРаботим с естествени материали и малки серии — когато нещо свърши, идва ново, но никога същото.", img: "1452860606245-08befc0ff44b" },
    promo: { title: "−20% за първа поръчка", text: "Използвай код ПЪРВА при поръчка над 40 €.", img: "1493106641515-6b5631de4bb9" },
    gallery: ["1565193566173-7a0ee3dbe261", "1493106641515-6b5631de4bb9", "1602874801007-bd458bb1b8b6", "1610701596007-11502861dcfa"],
    testimonials: [
      { name: "Мария Г.", text: "Чашата е още по-красива на живо. Усеща се, че е правена с любов." },
      { name: "Иван П.", text: "Перфектен подарък. Доставиха за 2 дни, опаковано като бижу." },
    ],
    faq: [
      { question: "Мога ли да поръчам персонализация?", answer: "Да! Пиши ни бележка към поръчката — надпис, цвят или размер по желание." },
      { question: "Колко време отнема изработката?", answer: "Наличните продукти пътуват до 2 дни; по поръчка — до 2 седмици." },
    ],
  },
  {
    // ТЕМА: vitrina (изчистена светла)
    slug: "vitrina-moda",
    email: "demo+vitrina@frizmoshops.bg",
    shop: {
      name: "VITRINA",
      businessCategory: "Дрехи и мода",
      description:
        "Съвременна мода за градския човек. Изчистени силуети, качествени тъкани, без излишен шум.",
      city: "София",
      phone: "+359888100002",
      facebook: "https://facebook.com/vitrina",
      instagram: "https://instagram.com/vitrina",
    },
    theme: { theme: "vitrina", primaryColor: "#111111", accentColor: "#b4532a", headerVariant: 3 },
    heroImage: "1483985988355-763728e1935b",
    categories: [
      { name: "Жени", children: ["Рокли", "Палта"] },
      { name: "Мъже", children: [] },
    ],
    products: [
      { name: "Вълнено палто „Осло“", slug: "palto-oslo", price: 18900, promo: 14900, img: "1539533018447-63fcce2678e3", cat: "Палта", stock: 8, attrs: [["Състав", "80% вълна"], ["Кройка", "Oversize"]], deal: null },
      { name: "Ленена рокля „Бриз“", slug: "rokla-briz", price: 8900, promo: null, img: "1595777457583-95e059d581b8", cat: "Рокли", stock: 12, attrs: [["Материал", "100% лен"]], deal: null },
      { name: "Класическа бяла риза", slug: "bqla-riza", price: 5900, promo: null, img: "1596755094514-f87e34085b2c", cat: "Мъже", stock: 20, attrs: [["Яка", "Италианска"]], deal: { quantity: 2, total: 10000 } },
      { name: "Кашмирен пуловер", slug: "kashmiren-pulover", price: 12900, promo: null, img: "1576871337622-98d48d1cf531", cat: "Жени", stock: 6, attrs: [["Състав", "100% кашмир"]], deal: null },
      { name: "Кожена чанта „Милано“", slug: "chanta-milano", price: 15900, promo: null, img: "1548036328-c9fa89d128fa", cat: "Жени", stock: 4, attrs: [["Кожа", "Естествена"]], deal: null },
    ],
    imageText: { title: "По-малко, но по-добро", text: "Вярваме в дрехи, които се носят с години, не с месеци.\n\nВсяка колекция е малка и обмислена — избираме тъкани, които издържат и остаряват красиво.", img: "1441984904996-e0b6ba687e04" },
    promo: { title: "Есенна разпродажба", text: "До −40% на избрани палта и якета.", img: "1539533018447-63fcce2678e3" },
    gallery: ["1483985988355-763728e1935b", "1441984904996-e0b6ba687e04", "1539533018447-63fcce2678e3", "1595777457583-95e059d581b8"],
    testimonials: [
      { name: "Елена Д.", text: "Палтото стана любимата ми дреха. Качеството си личи от пръв допир." },
      { name: "Георги М.", text: "Ризата е перфектна — стои като по мярка. Ще купя още." },
    ],
    faq: [
      { question: "Как да избера размер?", answer: "Виж таблицата с размери на всеки продукт или ни пиши за съвет." },
      { question: "Мога ли да върна артикул?", answer: "Да, до 30 дни в оригинално състояние." },
    ],
  },
  {
    // ТЕМА: puls (тъмна смела)
    slug: "puls-streetwear",
    email: "demo+puls@frizmoshops.bg",
    shop: {
      name: "PULS",
      businessCategory: "Дрехи и мода",
      description:
        "Streetwear за тези, които не се крият. Смели щампи, лимитирани дропки, нула компромиси.",
      city: "София",
      phone: "+359888100003",
      facebook: "https://facebook.com/pulswear",
      instagram: "https://instagram.com/pulswear",
    },
    theme: { theme: "puls", primaryColor: "#e8ff45", accentColor: "#ff4d6d" },
    heroImage: "1523398002811-999ca8dec234",
    categories: [
      { name: "Тениски", children: [] },
      { name: "Суичъри", children: [] },
      { name: "Шапки", children: [] },
    ],
    products: [
      { name: "Оувърсайз тениска „NOISE“", slug: "teniska-noise", price: 4900, promo: null, img: "1521572163474-6864f9cf17ab", cat: "Тениски", stock: 30, attrs: [["Плат", "240 г памук"], ["Кройка", "Boxy"]], deal: { quantity: 2, total: 8500 } },
      { name: "Худи „VOID“ черно", slug: "hudi-void", price: 8900, promo: 6900, img: "1556821840-3a63f95609a7", cat: "Суичъри", stock: 15, attrs: [["Плат", "380 г"]], deal: null },
      { name: "Снапбек „PULS“", slug: "snapback-puls", price: 3200, promo: null, img: "1588850561407-ed78c282e89b", cat: "Шапки", stock: 40, attrs: [["Размер", "Регулируем"]], deal: null },
      { name: "Карго панталон „RAID“", slug: "kargo-raid", price: 9900, promo: null, img: "1517445312882-bc9910d016b7", cat: "Суичъри", stock: 10, attrs: [["Джобове", "6"]], deal: null },
      { name: "Тениска „GLITCH“ бяла", slug: "teniska-glitch", price: 4900, promo: null, img: "1583743814966-8936f5b7be1a", cat: "Тениски", stock: 25, attrs: [["Плат", "240 г памук"]], deal: null },
    ],
    imageText: { title: "Направено на улицата, за улицата", text: "Не следваме трендове — създаваме ги.\n\nВсяка дропка е лимитирана. Когато свърши, свърши. Без повторни серии, без изключения.", img: "1523398002811-999ca8dec234" },
    promo: { title: "НОВА ДРОПКА ПЕТЪК 20:00", text: "Абонирай се и бъди първи. Разпродава се за минути.", img: "1556821840-3a63f95609a7" },
    gallery: ["1523398002811-999ca8dec234", "1521572163474-6864f9cf17ab", "1556821840-3a63f95609a7", "1517445312882-bc9910d016b7"],
    testimonials: [
      { name: "Дидо", text: "Худито е огън. Качеството надминава цената. Респект." },
      { name: "Криси", text: "Най-накрая бранд с истински вайб. Купувам всичко." },
    ],
    faq: [
      { question: "Кога е следващата дропка?", answer: "Всеки петък 20:00. Следвай ни в Instagram за анонси." },
      { question: "Материалите какви са?", answer: "Тежък памук 240–380 г. Направено да издържа." },
    ],
  },
  {
    // ТЕМА: efir (светла wellness)
    slug: "efir-kozmetika",
    email: "demo+efir@frizmoshops.bg",
    shop: {
      name: "Ефир",
      businessCategory: "Козметика",
      description:
        "Натурална козметика с българска роза и лавандула. Малки партиди, чисти съставки, видими резултати.",
      city: "Казанлък",
      phone: "+359888100004",
      facebook: "https://facebook.com/efir.care",
      instagram: "https://instagram.com/efir.care",
    },
    theme: { theme: "efir", primaryColor: "#c98a9b", accentColor: "#7a9b8e" },
    heroImage: "1556228720-195a672e8a03",
    categories: [
      { name: "Грижа за лице", children: [] },
      { name: "Грижа за тяло", children: [] },
    ],
    products: [
      { name: "Крем за лице с розово масло", slug: "krem-roza", price: 3400, promo: 2900, img: "1556228720-195a672e8a03", cat: "Грижа за лице", stock: 18, attrs: [["Обем", "50 мл"], ["Съставки", "Роза Дамасцена, ший, витамин Е"]], deal: null },
      { name: "Серум с хиалурон", slug: "serum-hialuron", price: 4200, promo: null, img: "1571781926291-c477ebfd024b", cat: "Грижа за лице", stock: 10, attrs: [["Обем", "30 мл"]], deal: null },
      { name: "Лавандулово масло за тяло", slug: "maslo-lavandula", price: 2600, promo: null, img: "1570172619644-dfd03ed5d881", cat: "Грижа за тяло", stock: 14, attrs: [["Обем", "100 мл"]], deal: { quantity: 2, total: 4500 } },
      { name: "Скраб с кафе и какао", slug: "skrab-kafe", price: 1900, promo: null, img: "1608248543803-ba4f8c70ae0b", cat: "Грижа за тяло", stock: 22, attrs: [["Тегло", "200 г"]], deal: null },
      { name: "Тоник с розова вода", slug: "tonik-roza", price: 2200, promo: null, img: "1595872018818-97555653a011", cat: "Грижа за лице", stock: 16, attrs: [["Обем", "150 мл"]], deal: null },
    ],
    imageText: { title: "Чисти съставки, честни етикети", text: "Всичко, което слагаме в бурканчето, можеш да прочетеш и разбереш.\n\nБез парабени, без силикони, без компромиси — тествано върху нас, не върху животни.", img: "1596462502278-27bfdc403348" },
    promo: { title: "Подарък при поръчка над 50 €", text: "Мини тоник с розова вода в комплект.", img: "1571781926291-c477ebfd024b" },
    gallery: ["1556228720-195a672e8a03", "1596462502278-27bfdc403348", "1571781926291-c477ebfd024b", "1570172619644-dfd03ed5d881"],
    testimonials: [
      { name: "Ния В.", text: "Кожата ми е по-мека и сияеща от седмици. Ароматът е божествен." },
      { name: "Радост К.", text: "Най-после козметика без химия, на която вярвам." },
    ],
    faq: [
      { question: "Подходящи ли са за чувствителна кожа?", answer: "Да — формулите са хипоалергенни. При съмнение направи тест на малък участък." },
      { question: "Какъв е срокът на годност?", answer: "6–12 месеца от отваряне (отбелязан на всеки продукт)." },
    ],
  },
  {
    // ТЕМА: oniks (тъмна premium)
    slug: "oniks-luks",
    email: "demo+oniks@frizmoshops.bg",
    shop: {
      name: "MAISON ONYX",
      businessCategory: "Козметика",
      description:
        "Луксозна грижа за онези, които не приемат компромис. Редки съставки, дискретна елегантност.",
      city: "София",
      phone: "+359888100005",
      facebook: "https://facebook.com/maisononyx",
      instagram: "https://instagram.com/maisononyx",
    },
    theme: { theme: "oniks", primaryColor: "#c9a25a", accentColor: "#c9a25a", headerVariant: 2 },
    heroImage: "1592945403244-b3fbafd7f539",
    categories: [
      { name: "Серуми", children: [] },
      { name: "Парфюми", children: [] },
    ],
    products: [
      { name: "Серум „OR“ 24k", slug: "serum-or", price: 12000, promo: null, img: "1592945403244-b3fbafd7f539", cat: "Серуми", stock: 8, attrs: [["Обем", "30 мл"], ["Активи", "Злато, ретинол"]], deal: null },
      { name: "Крем „NUIT“ нощен", slug: "krem-nuit", price: 9500, promo: 7900, img: "1608248597279-f99d160bfcbc", cat: "Серуми", stock: 12, attrs: [["Обем", "50 мл"]], deal: null },
      { name: "Парфюм „NOIR“ 50мл", slug: "parfyum-noir", price: 18000, promo: null, img: "1541643600914-78b084683601", cat: "Парфюми", stock: 6, attrs: [["Концентрация", "EDP"]], deal: null },
      { name: "Олио за лице „ROSE D'OR“", slug: "olio-rose-dor", price: 8800, promo: null, img: "1611930022073-b7a4ba5fcccd", cat: "Серуми", stock: 10, attrs: [["Обем", "30 мл"]], deal: { quantity: 2, total: 15000 } },
      { name: "Парфюм „BLANC“ 50мл", slug: "parfyum-blanc", price: 16000, promo: null, img: "1594035910387-fea47794261f", cat: "Парфюми", stock: 5, attrs: [["Концентрация", "EDP"]], deal: null },
    ],
    imageText: { title: "Наука, облечена в лукс", text: "Всяка формула се ражда от години изследвания и най-редки съставки.\n\nСъздаваме не просто грижа — а ритуал, който заслужаваш.", img: "1615634260167-c8cdede054de" },
    promo: { title: "Дискретна доставка, безплатно", text: "Всяка поръчка пътува в елегантна опаковка, дискретно.", img: "1608248597279-f99d160bfcbc" },
    gallery: ["1592945403244-b3fbafd7f539", "1615634260167-c8cdede054de", "1541643600914-78b084683601", "1611930022073-b7a4ba5fcccd"],
    testimonials: [
      { name: "Елена В.", text: "Кожата ми не е изглеждала така от години. Струва си всяка стотинка." },
      { name: "Никол Д.", text: "Опаковката, ароматът, ефектът — всичко крещи качество." },
    ],
    faq: [
      { question: "Съставките откъде са?", answer: "Работим с избрани доставчици от Грас и Швейцария." },
      { question: "Имате ли мостри?", answer: "Да — добавяме мостра при всяка поръчка над 100 €." },
    ],
  },
  {
    // ТЕМА: signal (студена структурирана)
    slug: "signal-tehnika",
    email: "demo+signal@frizmoshops.bg",
    shop: {
      name: "Сигнал Техника",
      businessCategory: "Електроника",
      description:
        "Проверена техника и аксесоари. Ясни спецификации, реални наличности, бърза доставка.",
      city: "Варна",
      phone: "+359888100006",
      facebook: "https://facebook.com/signaltech",
      instagram: "https://instagram.com/signaltech",
    },
    theme: { theme: "signal", primaryColor: "#0e7490", accentColor: "#d97706" },
    heroImage: "1498049794561-7780e7231661",
    categories: [
      { name: "Аудио", children: ["Слушалки", "Колони"] },
      { name: "Аксесоари", children: [] },
    ],
    products: [
      { name: "Слушалки ANC „Focus X“", slug: "slushalki-focus-x", price: 24900, promo: 19900, img: "1505740420928-5e560c06d30e", cat: "Слушалки", stock: 20, attrs: [["Тип", "Over-ear"], ["Батерия", "40 ч"], ["Свързаност", "BT 5.3"]], deal: null },
      { name: "Bluetooth колона „Pulse 2“", slug: "kolona-pulse-2", price: 12900, promo: null, img: "1608043152269-423dbba4e7e1", cat: "Колони", stock: 15, attrs: [["Мощност", "20W"], ["IP", "IPX7"]], deal: null },
      { name: "Кабел USB-C 100W 2м", slug: "kabel-usbc-100w", price: 1900, promo: null, img: "1585298723682-7115561c51b7", cat: "Аксесоари", stock: 60, attrs: [["Дължина", "2 м"], ["Мощност", "100W"]], deal: { quantity: 3, total: 4500 } },
      { name: "Powerbank 20000mAh", slug: "powerbank-20000", price: 5900, promo: null, img: "1609091839311-d5365f9ff1c5", cat: "Аксесоари", stock: 30, attrs: [["Капацитет", "20000 mAh"], ["Изходи", "3"]], deal: null },
      { name: "Слушалки TWS „Air Lite“", slug: "slushalki-air-lite", price: 8900, promo: null, img: "1590658268037-6bf12165a8df", cat: "Слушалки", stock: 25, attrs: [["Тип", "In-ear"], ["Батерия", "24 ч"]], deal: null },
    ],
    imageText: { title: "Купуваш веднъж, работи години", text: "Подбираме само техника, която сами бихме ползвали.\n\nВсеки продукт минава през реален тест — не препродаваме нищо, което не вярваме.", img: "1518770660439-4636190af475" },
    promo: { title: "−20% на слушалки Focus X", text: "Само тази седмица или до изчерпване на количествата.", img: "1505740420928-5e560c06d30e" },
    gallery: ["1498049794561-7780e7231661", "1518770660439-4636190af475", "1505740420928-5e560c06d30e", "1608043152269-423dbba4e7e1"],
    testimonials: [
      { name: "Мартин С.", text: "Слушалките са страхотни, а доставката — за един ден. Препоръчвам." },
      { name: "Валери Т.", text: "Ясни описания, реални наличности. Точно каквото търсех." },
    ],
    faq: [
      { question: "Има ли гаранция?", answer: "Да — 24 месеца официална гаранция на всички устройства." },
      { question: "Кога получавам поръчката?", answer: "До 1–2 работни дни за цялата страна." },
    ],
  },
  {
    // ТЕМА: osnova (светла индустриална)
    slug: "osnova-stroiteli",
    email: "demo+osnova@frizmoshops.bg",
    shop: {
      name: "ОСНОВА",
      businessCategory: "Строителни материали",
      description:
        "Строителни материали и инструменти на едро и дребно. Качество за майстори и домакинства.",
      city: "Пловдив",
      phone: "+359888100007",
      facebook: "https://facebook.com/osnova.bg",
      instagram: "https://instagram.com/osnova.bg",
    },
    theme: { theme: "osnova", primaryColor: "#d98a1e", accentColor: "#3f6212" },
    heroImage: "1504307651254-35680f356dfd",
    categories: [
      { name: "Инструменти", children: ["Ръчни", "Електрически"] },
      { name: "Материали", children: [] },
    ],
    products: [
      { name: "Ударна бормашина 850W", slug: "bormashina-850w", price: 12900, promo: 9900, img: "1504148455328-c376907d081c", cat: "Електрически", stock: 12, attrs: [["Мощност", "850W"], ["Патронник", "13 мм"]], deal: null },
      { name: "Комплект отвертки 12 бр", slug: "otvertki-12", price: 3400, promo: null, img: "1581147036324-c17ac41dfe6c", cat: "Ръчни", stock: 40, attrs: [["Части", "12"], ["Стомана", "CrV"]], deal: { quantity: 2, total: 6000 } },
      { name: "Циментов разтвор 25кг", slug: "cimentov-raztvor", price: 890, promo: null, img: "1518709268805-4e9042af9f23", cat: "Материали", stock: 200, attrs: [["Тегло", "25 кг"]], deal: null },
      { name: "Ъглошлайф 125мм", slug: "agloshlaif-125", price: 7900, promo: null, img: "1572981779307-38b8cabb2407", cat: "Електрически", stock: 18, attrs: [["Диск", "125 мм"], ["Мощност", "900W"]], deal: null },
      { name: "Ролетка 5м", slug: "roletka-5m", price: 1200, promo: null, img: "1600725935160-f67ee4f6084a", cat: "Ръчни", stock: 50, attrs: [["Дължина", "5 м"]], deal: null },
    ],
    imageText: { title: "Инструменти, на които разчиташ", text: "Знаем колко струва един провален проект заради лош инструмент.\n\nЗатова държим само марки, проверени на реални обекти — за майстора и за дома.", img: "1503387762-592deb58ef4e" },
    promo: { title: "Отстъпки за майстори", text: "Регистрирай се като професионалист за специални цени.", img: "1504148455328-c376907d081c" },
    gallery: ["1504307651254-35680f356dfd", "1503387762-592deb58ef4e", "1504148455328-c376907d081c", "1581147036324-c17ac41dfe6c"],
    testimonials: [
      { name: "Пламен Д.", text: "Бормашината е звяр. Цената — най-добрата, която намерих." },
      { name: "Стоян К.", text: "Доставят бързо до обекта. За професионалист това е всичко." },
    ],
    faq: [
      { question: "Доставяте ли до обект?", answer: "Да — до всеки адрес в страната, включително строителни площадки." },
      { question: "Има ли количествени отстъпки?", answer: "Да, за поръчки на едро и за регистрирани майстори." },
    ],
  },
  {
    // ТЕМА: granit (тъмна индустриална)
    slug: "granit-instrumenti",
    email: "demo+granit@frizmoshops.bg",
    shop: {
      name: "ГРАНИТ",
      businessCategory: "Строителни материали",
      description:
        "Професионални инструменти за тези, които не спират. Направено да издържи на всичко.",
      city: "София",
      phone: "+359888100008",
      facebook: "https://facebook.com/granit.tools",
      instagram: "https://instagram.com/granit.tools",
    },
    theme: { theme: "granit", primaryColor: "#f0a63c", accentColor: "#5eead4" },
    heroLayout: "statement",
    heroImage: "1530124566582-a618bc2615dc",
    categories: [
      { name: "Машини", children: [] },
      { name: "Ръчни инструменти", children: [] },
    ],
    products: [
      { name: "Перфоратор SDS-Plus 1500W", slug: "perforator-1500w", price: 28900, promo: null, img: "1572981779307-38b8cabb2407", cat: "Машини", stock: 8, attrs: [["Мощност", "1500W"], ["Енергия", "5 J"]], deal: null },
      { name: "Акумулаторен винтоверт 18V", slug: "vintovert-18v", price: 15900, promo: 12900, img: "1591006853040-45a5e29e7b09", cat: "Машини", stock: 14, attrs: [["Волтаж", "18V"], ["Батерии", "2 бр"]], deal: null },
      { name: "Чук 500г професионален", slug: "chuk-500", price: 2400, promo: null, img: "1586864387967-d02ef85d93e8", cat: "Ръчни инструменти", stock: 30, attrs: [["Тегло", "500 г"]], deal: { quantity: 2, total: 4200 } },
      { name: "Комплект ключове 24 бр", slug: "kluchove-24", price: 8900, promo: null, img: "1607472586893-edb57bdc0e39", cat: "Ръчни инструменти", stock: 12, attrs: [["Части", "24"]], deal: null },
      { name: "Циркуляр 1200W", slug: "cirkulyar-1200", price: 18900, promo: null, img: "1504148455328-c376907d081c", cat: "Машини", stock: 6, attrs: [["Мощност", "1200W"], ["Диск", "185 мм"]], deal: null },
    ],
    imageText: { title: "Създадено за най-тежкото", text: "Всеки инструмент е тестван на реален обект, не в лаборатория.\n\nАко издържи при нас, ще издържи и при теб. Гаранция на всичко.", img: "1516216628859-9bcc7d6a56db" },
    promo: { title: "Trade-in програма", text: "Донеси стар инструмент, вземи отстъпка за нов.", img: "1591006853040-45a5e29e7b09" },
    gallery: ["1530124566582-a618bc2615dc", "1516216628859-9bcc7d6a56db", "1572981779307-38b8cabb2407", "1591006853040-45a5e29e7b09"],
    testimonials: [
      { name: "Ивайло М.", text: "Перфораторът върви като танк. За професионалист — задължителен." },
      { name: "Красимир Т.", text: "Гаранцията е реална, обслужването — бързо. Вярвам им." },
    ],
    faq: [
      { question: "Каква е гаранцията на машините?", answer: "36 месеца за професионална линия, с безплатен сервиз." },
      { question: "Има ли резервни части?", answer: "Да — държим резервни части за всички основни модели." },
    ],
  },
  {
    // ТЕМА: classic (неутрална)
    slug: "klasik-za-doma",
    email: "demo+klasik@frizmoshops.bg",
    shop: {
      name: "Дом и Уют",
      businessCategory: "За дома",
      description:
        "Всичко за дома — от текстил до аксесоари. Практични и красиви неща за всеки ден.",
      city: "Бургас",
      phone: "+359888100009",
      facebook: "https://facebook.com/domiuyut",
      instagram: "https://instagram.com/domiuyut",
    },
    theme: { theme: "classic", primaryColor: "#0e7c4a", accentColor: "#c98a1b" },
    heroImage: "1513694203232-719a280e022f",
    categories: [
      { name: "Текстил", children: ["Възглавници", "Одеяла"] },
      { name: "Декорация", children: [] },
    ],
    products: [
      { name: "Декоративна възглавница „Лен“", slug: "vazglavnica-len", price: 2900, promo: null, img: "1584100936595-c0654b55a2e6", cat: "Възглавници", stock: 25, attrs: [["Материал", "Лен"], ["Размер", "45×45 см"]], deal: { quantity: 2, total: 5000 } },
      { name: "Плетено одеяло", slug: "pleteno-odeqlo", price: 6900, promo: 5500, img: "1616486338812-3dadae4b4ace", cat: "Одеяла", stock: 10, attrs: [["Размер", "130×170 см"]], deal: null },
      { name: "Ароматна свещ „Ванилия“", slug: "svesht-vanilia", price: 1800, promo: null, img: "1602874801007-bd458bb1b8b6", cat: "Декорация", stock: 40, attrs: [["Горене", "~35 часа"]], deal: null },
      { name: "Керамична купа за плодове", slug: "kupa-plodove", price: 3400, promo: null, img: "1493106641515-6b5631de4bb9", cat: "Декорация", stock: 15, attrs: [["Диаметър", "28 см"]], deal: null },
      { name: "Памучен плед на райета", slug: "pamuchen-pled", price: 4200, promo: null, img: "1580301762395-83a09b8f7f79", cat: "Одеяла", stock: 12, attrs: [["Материал", "Памук"]], deal: null },
    ],
    imageText: { title: "Малките неща правят дома", text: "Домът не е за показ — той е за живеене.\n\nИзбираме предмети, които са колкото красиви, толкова и полезни, за всеки ден.", img: "1522708323590-d24dbb6b0267" },
    promo: { title: "Обнови дома си", text: "Комплект възглавница + одеяло на специална цена.", img: "1616486338812-3dadae4b4ace" },
    gallery: ["1513694203232-719a280e022f", "1522708323590-d24dbb6b0267", "1584100936595-c0654b55a2e6", "1616486338812-3dadae4b4ace"],
    testimonials: [
      { name: "Веселина П.", text: "Одеялото е прекрасно и топло. Домът ми стана по-уютен." },
      { name: "Таня Г.", text: "Качествени неща на честни цени. Ще пазарувам пак." },
    ],
    faq: [
      { question: "Как се перат текстилните продукти?", answer: "На 30°C, деликатна програма. Указания има на всеки етикет." },
      { question: "Правите ли подаръчни опаковки?", answer: "Да — отбележи в поръчката и ще опаковаме за подарък." },
    ],
  },
];

/**
 * Строи ВСИЧКИТЕ 13 секции с реално съдържание. Снимковите пътища идват вече
 * качени (paths), за да не се качва по няколко пъти. featuredIds пази ред за
 * manual секцията.
 */
function buildAllSections(niche, paths, featuredIds) {
  return [
    section("announcement", { text: "Безплатна доставка за поръчки над 60 €", href: "" }),
    section("hero", {
      /* heroLayout per ниша (Гранит = statement — живият еталон на варианта). */
      layout: niche.heroLayout ?? "split",
      title: niche.shop.name,
      subtitle: niche.shop.description.split(".")[0] + ".",
      ctaLabel: "Разгледай продуктите",
      ctaHref: "",
      imagePaths: paths.hero ? [paths.hero] : [],
    }),
    section("trust-badges", {
      items: [
        { icon: "truck", text: "Бърза доставка" },
        { icon: "return", text: "Връщане до 14 дни" },
        { icon: "shield", text: "Сигурно плащане" },
        { icon: "star", text: "Проверено качество" },
      ],
    }),
    section("featured-products", { title: "Най-нови продукти", mode: "newest", productIds: [] }),
    section("category-grid", { title: "Разгледай по категория", categoryIds: [] }),
    section("promo-banner", {
      title: niche.promo.title,
      text: niche.promo.text,
      ctaLabel: "Виж офертата",
      ctaHref: "",
      imagePath: paths.promo ?? "",
    }),
    section("image-text", {
      title: niche.imageText.title,
      text: niche.imageText.text,
      imagePath: paths.imageText ?? "",
      imageSide: "left",
    }),
    section("featured-products", { title: "Избрани за теб", mode: "manual", productIds: featuredIds.slice(0, 3) }),
    section("rich-text", {
      title: "За нас",
      text: niche.shop.description + "\n\nБлагодарим, че избираш локален бизнес — всяка поръчка има значение за нас.",
    }),
    section("gallery", { title: "Галерия", imagePaths: paths.gallery }),
    section("testimonials", { title: "Какво казват клиентите", items: niche.testimonials }),
    section("faq", { title: "Често задавани въпроси", items: niche.faq }),
    section("contact-map", { title: "Къде да ни намериш", showMap: true }),
    section("socials", { title: "Последвай ни" }),
  ];
}

for (const niche of NICHES) {
  const existing = await sql`select id from shops where slug = ${niche.slug} limit 1`;
  if (existing.length > 0) {
    console.log(`= ${niche.shop.name} (вече съществува)`);
    continue;
  }
  console.log(`+ ${niche.shop.name} [тема: ${niche.theme.theme}]`);

  /* Акаунт */
  const password = randomBytes(24).toString("base64url");
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: niche.email,
    password,
    email_confirm: true,
  });
  let userId = userData?.user?.id;
  if (userError) {
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
      ${niche.email}, 'published',
      ${sql.json({ days: [0, 1, 2, 3, 4].map(() => ({ closed: false, open: "09:00", close: "18:00" })).concat([{ closed: true, open: "09:00", close: "18:00" }, { closed: true, open: "09:00", close: "18:00" }]) })},
      ${sql.json({ facebook: niche.shop.facebook, instagram: niche.shop.instagram })})
    returning id`;
  const shopId = shopRow.id;

  /* Fulfillment дефолти */
  await sql`insert into shipping_methods (shop_id, type, name, price_cents, free_over_cents)
    values (${shopId}, 'courier', 'Куриер до адрес', 500, 6000)`;
  await sql`insert into payment_methods (shop_id, type, name, details)
    values (${shopId}, 'cod', 'Наложен платеж', 'Плащаш на куриера при получаване.')`;
  /* Демо ePay онлайн плащане САМО за първия магазин (за e2e/ръчна проверка).
     Demo KIN/secret — не са реален акаунт; жива транзакция чака реален ePay. */
  if (niche.slug === "atelie-glina") {
    await sql`insert into payment_methods (shop_id, type, name)
      values (${shopId}, 'online_card', 'Карта (ePay)')`;
    await sql`insert into shop_payment_accounts (shop_id, provider, credentials)
      values (${shopId}, 'epay', ${sql.json({ kin: "1234567890", secret: "demosecret" })})
      on conflict (shop_id, provider) do nothing`;
  }

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
  const productIds = [];
  for (const p of niche.products) {
    const imgPath = await uploadImage(shopId, p.img, "products");
    const [prod] = await sql`
      insert into products (shop_id, category_id, name, slug, description, price_cents,
        promo_price_cents, images, status, stock)
      values (${shopId}, ${catIds[p.cat] ?? null}, ${p.name}, ${p.slug},
        ${p.attrs.map(([k, v]) => `${k}: ${v}`).join(". ") + "."},
        ${p.price}, ${p.promo}, ${sql.json(imgPath ? [imgPath] : [])}, 'active', ${p.stock})
      returning id`;
    productIds.push(prod.id);
    for (const [i, [name, value]] of p.attrs.entries()) {
      await sql`insert into product_attributes (product_id, name, value, sort_order)
        values (${prod.id}, ${name}, ${value}, ${i})`;
    }
    if (p.deal) {
      await sql`insert into promotions (shop_id, product_id, quantity, total_price_cents)
        values (${shopId}, ${prod.id}, ${p.deal.quantity}, ${p.deal.total})`;
    }
  }

  /* Снимки за секциите (качват се веднъж) */
  const paths = {
    hero: await uploadImage(shopId, niche.heroImage, "site"),
    imageText: await uploadImage(shopId, niche.imageText.img, "site"),
    promo: await uploadImage(shopId, niche.promo.img, "site"),
    gallery: [],
  };
  for (const g of niche.gallery) {
    const gp = await uploadImage(shopId, g, "site");
    if (gp) paths.gallery.push(gp);
  }

  /* Уебсайт настройки — ВСИЧКИ 13 секции */
  const settings = {
    ...niche.theme,
    /* headerVariant демонстрира трите композиции: default 1 (inline), но
       Оникс/Ателие → 2 (центриран, лукс/editorial), Витрина → 3 (минимал). */
    headerVariant: niche.theme.headerVariant ?? 1,
    footerText: niche.shop.description.split(".")[0] + ".",
    aboutText: niche.imageText.text,
    aboutImagePaths: paths.imageText ? [paths.imageText] : [],
    sections: buildAllSections(niche, paths, productIds),
  };
  await sql`insert into site_settings (shop_id, settings) values (${shopId}, ${sql.json(settings)})
    on conflict (shop_id) do update set settings = ${sql.json(settings)}, updated_at = now()`;

  console.log(`  ✓ ${niche.products.length} продукта, 13 секции · /s/${niche.slug}`);
}

const [counts] = await sql`select count(*) as shops from shops where status = 'published'`;
console.log(`\nГотово. Published магазини общо: ${counts.shops}`);
console.log("Тествай всяка тема:");
for (const n of NICHES) console.log(`  ${n.theme.theme.padEnd(8)} → /s/${n.slug}`);
await sql.end();
