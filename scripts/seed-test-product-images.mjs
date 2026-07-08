/**
 * Качва безплатни стокови снимки (picsum.photos) към продуктите на test-magazin-1
 * БЕЗ снимка — за да изглеждат реално при теста на storefront-а. АДИТИВЕН:
 * пропуска продукти, които вече имат снимка. Owner проверка за сигурност.
 *
 * Снимките се качват в Supabase Storage (bucket shop-media, публично четене),
 * пътят се записва в products.images — точно като реалното качване в приложението.
 *
 * Употреба: node --env-file=.env.local scripts/seed-test-product-images.mjs
 */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const SHOP_SLUG = "test-magazin-1";
const OWNER_EMAIL = "e.s.kostadinov34@gmail.com";
const BUCKET = "shop-media";

const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

/* Транслитерация за стабилен seed (същите снимки при повторно пускане). */
const CYR = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s",
  т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht",
  ъ: "a", ь: "y", ю: "yu", я: "ya",
};
const seedFrom = (s) =>
  s.toLowerCase().split("").map((c) => CYR[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

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

  const prods = await sql`
    select id, name, images from products where shop_id = ${shop.id} order by created_at`;

  let added = 0;
  let skipped = 0;
  for (const p of prods) {
    if (Array.isArray(p.images) && p.images.length > 0) {
      skipped++;
      continue;
    }

    /* Стабилна стокова снимка по името (seed) → еднаква при повторно пускане. */
    const seed = seedFrom(p.name) || p.id.slice(0, 8);
    const res = await fetch(`https://picsum.photos/seed/${seed}/800/800.jpg`);
    if (!res.ok) {
      console.error(`  ✗ ${p.name}: сваляне се провали (${res.status})`);
      continue;
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    const path = `shops/${shop.id}/products/test-${seed}.jpg`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
    if (upErr) {
      console.error(`  ✗ ${p.name}: качване се провали — ${upErr.message}`);
      continue;
    }

    await sql`update products set images = ${sql.json([path])}, updated_at = now() where id = ${p.id}`;
    console.log(`  + ${p.name} → ${path}`);
    added++;
  }

  console.log(`\n✓ Готово: снимки на ${added} продукта, пропуснати ${skipped} (вече имат).`);
  await sql.end();
}

main().catch(async (e) => {
  console.error("✗ Грешка:", e);
  await sql.end();
  process.exit(1);
});
