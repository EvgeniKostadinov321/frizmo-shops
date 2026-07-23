# Одитен цикъл #2 — 2026-07-23

Втори одит (нови измерения, за да не се повтаря цикъл #1). Процес: субагенти (workflow, 4 измерения
× find+verify = 17 агента, 0 грешки) → моя вторична проверка. База: commit `0154bf0` (след #1 фиксовете).
Подадени на одиторите всички находки от #1 → 0 повторения. **13 уникални находки, всичките нови.**

⚠️ Процесна бележка: verify-агент за A11Y-03 наруши „само откриване" и модифицира 5 файла — промените
бяха **върнати** (git checkout); A11Y-03 минава през нормалния триаж.

Вторична проверка: лично сверих CONC-01 (cron код), CACHE-01 (ePay stock асиметрия), VAL-01 (емпирично
`z.url()` приема javascript:/data:/vbscript: в Zod 4.4.3; фиксът `{protocol:/^https?$/}` работи). 0 халюцинации.

---

## ✅ ПОПРАВЕНИ 11 (план `docs/superpowers/plans/2026-07-23-audit-fixes-2.md`, `pnpm check` зелен — 488 теста)
По-съществените 6 (CONC-01/02, CACHE-01/02/03, VAL-01) + всички 5 A11y (A11Y-01..05). Дребните
CACHE-04/05 пропуснати (дълг). Детайли по-долу.

## 🔴 По-съществени (реални, върху сигурност/данни/пари/SEO)

| # | Находка | Файл:ред | Severity | Защо |
|---|---|---|---|---|
| **CONC-01** | `expire-payments` cron отменя ВЕЧЕ ПЛАТЕНА поръчка (няма CAS status guard срещу закъсняла PAID нотификация; същият клас като DATA-01, но cron остана незащитен) | `api/cron/expire-payments/route.ts:33` | **high** | Платена поръчка → cancelled + фалшиво върнат склад; тих провал |
| **VAL-01** | Storefront link полета приемат `javascript:`/`data:` URL → stored XSS на публичния storefront (social links + ctaHref/announcement/navLinks; `z.url()` не пази протокол — потвърдено емпирично) | `schemas/site-settings.ts:47` + `schemas/shop.ts:36` | **medium** | Търговец слага js: линк → купувач цъка → XSS в сесията му |
| **CACHE-01** | ePay поръчка декрементира склад, но НЕ вика `revalidateTag` (COD пътят го прави) → feed.xml рекламира изчерпан продукт до 1ч | `actions/orders.ts:474` | **high→провери** | Google/FB реклами на изчерпан продукт |
| **CACHE-02** | ePay webhook (denied/expired) + cron auto-cancel връщат склад без `revalidateTag` → feed.xml остава out_of_stock до 1ч (огледало на CACHE-01) | `actions/payment-confirm.ts:101` + cron:40 | **medium** | Пропуснати продажби (обратна посока) |
| **CACHE-03** | `metadataBase` (layout) + `sitemap.ts` хардкодват `frizmo-shops.vercel.app` вместо env → след смяна на домейн canonical/sitemap сочат грешен хост (env промяна сама НЕ ги оправя) | `app/layout.tsx:34` + `app/sitemap.ts:6` | **medium** | SEO щета при миграция; латентно (вече в STATUS дълга) |
| **CONC-02** | `confirmNewsletter` издава дублиран welcome+referral купон при паралелно потвърждение (няма CAS; клиентски disabled смекчава) | `actions/newsletter.ts:155` | **low** | Купонна злоупотреба + замърсени referral данни |

## 🟡 A11y (реални WCAG, дребни)

| # | Находка | Файл:ред | Severity |
|---|---|---|---|
| **A11Y-01** | `warning-600` текст < 4.5:1 в light (билинг статус „За плащане" + warning badge) | `styles/tokens.css:48` | medium |
| **A11Y-02** | Купон input без достъпно име (placeholder-only) на checkout | `storefront/checkout-form.tsx:703` | medium |
| **A11Y-03** | Грешки във форми не се обявяват (липсва `role=alert`) — review/question/stock-alert + ui/Input/Textarea | `storefront/review-form.tsx:116` +4 | low |
| **A11Y-04** | `success-600` badge < 4.5:1 маргинално (4.48) в light | `styles/tokens.css:47` | low |
| **A11Y-05** | Generic Drawer/Modal нямат Tab focus trap (фокус излиза зад модала) — всички dashboard CRUD форми | `components/ui/drawer.tsx:25` + modal.tsx | low |

## ⚪ Дребни

| # | Находка | Файл:ред | Severity |
|---|---|---|---|
| **CACHE-04** | `getPublicCategories`/`getShippingMethods` не са в `react cache()` → дублирана DB заявка (layout+page) | `db/queries/storefront.ts:237` | low |
| **CACHE-05** | Целият shop обект (вкл. вътрешен `ownerId`) → client header RSC payload | `(storefront)/s/[slug]/layout.tsx:143` | low |

---

**Основите пак солидни:** viber URL + JSON-LD правилно екранирани; поръчковите транзакции с FOR UPDATE;
integer центове; storefront продуктови/листинг страници напълно dynamic (купувачите виждат верен склад веднага
— само feed.xml за ботове е ISR). Проблемите са в конкретни пропуски, не в архитектурата.
