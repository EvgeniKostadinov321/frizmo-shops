/**
 * Еднократна миграция: старите shipping_methods с type='courier'.
 * Два случая:
 *   1. courier_provider != null → истински свързан куриер: създай courier_delivery_options
 *      (provider+target, fallback=цена, freeOver пренесен, name), после деактивирай метода.
 *   2. courier_provider == null → placeholder „Куриер до адрес" без реален куриер:
 *      конвертирай в type='local' (собствена доставка), за да остане валиден метод с
 *      фиксираната си цена (иначе магазинът остава без доставка). Типът 'courier' изчезва.
 * Идемпотентен: courier_delivery_options има ON CONFLICT DO NOTHING; конверсията към
 * local е безопасна при повторно пускане (вече няма courier редове).
 *
 * Пуска се: node --env-file=.env.local scripts/migrate-courier-methods.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });

try {
  const methods = await sql`
    select id, shop_id, name, price_cents, free_over_cents, courier_provider, delivery_target, active
    from shipping_methods where type = 'courier'`;
  console.log(`Намерени courier методи: ${methods.length}\n`);

  let linked = 0;
  let converted = 0;

  for (const m of methods) {
    if (m.courier_provider) {
      /* Случай 1: истински куриер → нова delivery option. */
      const target = m.delivery_target === "office" ? "office" : "address";
      await sql`
        insert into courier_delivery_options
          (shop_id, provider, delivery_target, active, display_name, fallback_price_cents, free_over_cents)
        values (${m.shop_id}, ${m.courier_provider}, ${target}, ${m.active},
                ${m.name}, ${m.price_cents}, ${m.free_over_cents})
        on conflict (shop_id, provider, delivery_target) do nothing`;
      /* Деактивирай стария метод (не го трием — order snapshot-и може да сочат към него). */
      await sql`update shipping_methods set active = false, updated_at = now() where id = ${m.id}`;
      linked++;
      console.log(`  ✅ свързан → delivery option: ${m.name} (${m.courier_provider}/${target})`);
    } else {
      /* Случай 2: placeholder без куриер → конвертирай в local (собствена доставка). */
      await sql`
        update shipping_methods
        set type = 'local', courier_provider = null, delivery_target = 'address', updated_at = now()
        where id = ${m.id}`;
      converted++;
      console.log(`  ↪ конвертиран в local: ${m.name} (shop ${m.shop_id.slice(0, 8)})`);
    }
  }

  console.log(`\nГотово: ${linked} свързани към delivery options, ${converted} конвертирани в local.`);

  const [{ n }] = await sql`select count(*)::int n from shipping_methods where type = 'courier'`;
  console.log(`Остатъчни courier методи: ${n} (трябва да е 0).`);
} catch (e) {
  console.error("Грешка:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
