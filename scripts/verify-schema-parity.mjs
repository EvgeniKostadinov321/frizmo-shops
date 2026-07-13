/**
 * Schema-parity проверка (P4-04): сравнява СХЕМАТА на две бази — обикновено dev
 * (Париж) и прод (Frankfurt) — за да хване дрифт, когато `db:push` е приложен на
 * едната, но не на другата. Проектът ползва drizzle-kit push БЕЗ versioned migration
 * файлове (съзнателен избор), така че git не пази история на schema промените;
 * този скрипт е предпазката срещу тих дрифт между двете среди.
 *
 * Сравнява (за схема `public`):
 *   • таблици — липсващи от едната страна
 *   • колони на всяка обща таблица — име + тип + nullable + default (сигнатура)
 *   • enum типове — етикети (напр. payment_type, order_status)
 *   • индекси — дефиниция (вкл. UNIQUE + състав на колоните). Индексите НЕ са в
 *     information_schema.columns, а разминаване в тях е реален риск (напр. S1-01:
 *     unique индекс, който трябва да включва shop_id) — затова се сравняват отделно.
 *
 * Употреба (две connection string-а през env; session pooler :5432):
 *   DB_A="<dev url>" DB_B="<prod url>" node scripts/verify-schema-parity.mjs
 * Или с --env-file, ако си сложил DB_A/DB_B в него:
 *   node --env-file=.env.parity scripts/verify-schema-parity.mjs
 *
 * Изход 0 = схемите съвпадат; 1 = дрифт (или конфигурационна грешка).
 * Скриптът е read-only — не пипа данни.
 */
import postgres from "postgres";

const urlA = process.env.DB_A;
const urlB = process.env.DB_B;
if (!urlA || !urlB) {
  console.error(
    "Липсва DB_A и/или DB_B. Подай двата connection string-а (session pooler :5432):\n" +
      '  DB_A="<dev url>" DB_B="<prod url>" node scripts/verify-schema-parity.mjs',
  );
  process.exit(1);
}

/** Хостът от connection string — за да се вижда коя база е коя (без креденшъли). */
const hostOf = (url) => url.replace(/^.*@/, "").replace(/[/?].*$/, "");
const LABEL_A = `A (${hostOf(urlA)})`;
const LABEL_B = `B (${hostOf(urlB)})`;

/** Сигнатура на колоните: "table.column" → "type|nullable|default". */
async function columnSignatures(sql) {
  const rows = await sql`
    select table_name, column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `;
  const map = new Map();
  for (const r of rows) {
    /* udt_name разграничава enum-и/варианти, които data_type скрива като "USER-DEFINED". */
    const type = r.data_type === "USER-DEFINED" ? r.udt_name : r.data_type;
    map.set(
      `${r.table_name}.${r.column_name}`,
      `${type}|${r.is_nullable}|${r.column_default ?? "∅"}`,
    );
  }
  return map;
}

/** Индекси: "table.index" → нормализирана дефиниция (UNIQUE + колони). */
async function indexSignatures(sql) {
  const rows = await sql`
    select tablename, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
    order by tablename, indexname
  `;
  const map = new Map();
  for (const r of rows) {
    /* Махаме конкретното име от дефиницията (то е и в ключа) и свиваме whitespace,
       за да сравняваме само същината: UNIQUE + таблица + колони + метод. */
    const def = r.indexdef.replace(/\s+/g, " ").replace(/ ON \S+ /, " ON <table> ").trim();
    map.set(`${r.tablename}.${r.indexname}`, def);
  }
  return map;
}

/** Enum типове: "enum_name" → сортирани етикети. */
async function enumSignatures(sql) {
  const rows = await sql`
    select t.typname, e.enumlabel
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    order by t.typname, e.enumsortorder
  `;
  const map = new Map();
  for (const r of rows) {
    map.set(r.typname, [...(map.get(r.typname) ?? []), r.enumlabel]);
  }
  const out = new Map();
  for (const [name, labels] of map) out.set(name, labels.join(","));
  return out;
}

/** Диф на две Map-и по ключ+стойност; връща масив от човешки редове. */
function diffMaps(a, b, kind) {
  const problems = [];
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of [...keys].sort()) {
    const va = a.get(k);
    const vb = b.get(k);
    if (va === undefined) problems.push(`${kind} „${k}" липсва в ${LABEL_A} (има го в ${LABEL_B})`);
    else if (vb === undefined) problems.push(`${kind} „${k}" липсва в ${LABEL_B} (има го в ${LABEL_A})`);
    else if (va !== vb) problems.push(`${kind} „${k}" се разминава: ${LABEL_A}=[${va}] vs ${LABEL_B}=[${vb}]`);
  }
  return problems;
}

const sqlA = postgres(urlA, { prepare: false });
const sqlB = postgres(urlB, { prepare: false });

try {
  const [colsA, colsB, enumsA, enumsB, idxA, idxB] = await Promise.all([
    columnSignatures(sqlA),
    columnSignatures(sqlB),
    enumSignatures(sqlA),
    enumSignatures(sqlB),
    indexSignatures(sqlA),
    indexSignatures(sqlB),
  ]);

  const problems = [
    ...diffMaps(colsA, colsB, "Колона"),
    ...diffMaps(enumsA, enumsB, "Enum"),
    ...diffMaps(idxA, idxB, "Индекс"),
  ];

  if (problems.length === 0) {
    console.log(`✓ Схемите съвпадат: ${LABEL_A} ↔ ${LABEL_B} (колони + enum-и + индекси).`);
    process.exit(0);
  }
  console.error(`✗ Открит schema дрифт (${problems.length}):`);
  for (const p of problems) console.error(`  • ${p}`);
  console.error("\nПусни `pnpm db:push` срещу изоставащата база, за да ги изравниш.");
  process.exit(1);
} catch (e) {
  console.error("Schema-parity грешка (връзка?):", e.message);
  process.exit(1);
} finally {
  await Promise.all([sqlA.end(), sqlB.end()]);
}
