# Website Builder — Вълна 3, част А: Комуникация (дизайн)

Дата: 2026-07-07 · Пътна карта: `docs/superpowers/plans/2026-07-06-builder-roadmap.md`

Вълна 3 е разбита на две части (решение 2026-07-07): **A — комуникация**
(контактна форма + newsletter, леки, споделят публичния endpoint pattern) и
**Б — промо кодове** (тежки, пипат ценовата логика — отделен спец после).

Тази част (A) дава на клиента **начини да се свърже** с търговеца: да пише
съобщение и да се абонира за новини. И двете преизползват съществуващите
публични pattern-и — нищо ново в инфраструктурата освен една таблица.

**Одобрени решения (2026-07-07):** контактна форма фиксирана на /contact, само
имейл (без запис в базата); newsletter = нова секция + double opt-in + таб
„Абонати" + CSV; newsletter БЕЗ изпращане на бюлетин (външна услуга).

---

## Преизползвани pattern-и (вече съществуват)

- **Rate limit:** `checkRateLimit(key, max, windowSec)` (`lib/rate-limit.ts`) —
  Postgres фиксиран прозорец, таблица `rate_limits`.
- **Client IP:** `clientIp()` (`actions/cart.ts`).
- **Honeypot:** поле `website` в схемата; непразно → фалшив успех (като
  `actions/orders.ts:67`).
- **Имейл:** Resend + `shell()`/`esc()` helper-и (`lib/email.ts`). Липсващ
  `RESEND_API_KEY` логва warning, не чупи.
- **Санитизация:** `sanitizeText`/`sanitizeMultiline` (`lib/sanitize.ts`).
- **Публичен action:** `ActionResult` + Zod `safeParse` + общи BG грешки.

---

## #2 Контактна форма — фиксирана на /contact, само имейл

**Проблем:** страница „Контакти" показва само адрес/карта. Клиент не може да
пише на търговеца от сайта.

**Данни:** БЕЗ нова таблица. Съобщението отива само като имейл до търговеца.

**Публичен action** (`src/actions/contact.ts`) — `sendContactMessage(shopSlug, formData)`:
1. Zod схема (`src/schemas/contact.ts`): `name` (2–80), `email` (валиден),
   `message` (10–2000), honeypot `website` (max 100, default "").
2. honeypot непразно → `ok()` (фалшив успех, ботът не разбира).
3. `checkRateLimit('contact:{ip}:{shopId}', 3, 3600)` — 3 съобщения/час/IP.
4. `sanitizeText(name)`, `sanitizeText(email)`, `sanitizeMultiline(message)`.
5. Магазинът трябва да има `shop.email` (иначе fail — няма къде да отиде).
6. Resend имейл до `shop.email`:
   - `from: FROM` (shops@frizmo.bg), `replyTo: клиентския имейл` (търговецът
     отговаря директно), subject „Ново съобщение от сайта — {name}".
   - `shell()` шаблон + `esc()` на всички стойности.
   - Липсващ ключ → fail „Изпращането е недостъпно, опитай по-късно".

**Storefront** (`ContactForm`, client, `useActionState`):
- Рендерира се на `/contact` под адреса/картата.
- Показва се САМО ако `shop.email` е зададен.
- Полета: Име, Имейл, Съобщение (+ скрит honeypot).
- Loading/success/error състояния; field-level Zod грешки; success →
  „Съобщението е изпратено, ще ти отговорим скоро" + reset.

---

## Newsletter — секция + double opt-in + таб „Абонати" + CSV

**Проблем:** няма събиране на имейли — основен маркетинг канал липсва.

**Обхват (изрично):** САМО събиране + CSV експорт. **БЕЗ изпращане на бюлетин**
(външна услуга — Mailchimp/Brevo; търговецът импортва CSV-то там).

**Данни — нова таблица `subscribers`** (`src/db/schema.ts`):
```
id: uuid pk
shopId: uuid → shops (тенант ключ)
email: text
status: enum ('pending' | 'confirmed' | 'unsubscribed') default 'pending'
token: text (уникален — за потвърждение/отписване)
createdAt, confirmedAt
```
Индекси: `unique(shopId, email)` (един имейл веднъж per магазин),
`index(shopId, status)`. `.enableRLS()`. Нов enum `subscriberStatusEnum`.

**Секция — нов тип `newsletter`:**
- В `sectionSchemas` (`schemas/site-settings.ts`): `data: { title, text }`
  (напр. „Абонирай се за -10%" / кратък текст). Без варианти за начало (един
  чист дизайн); може да получи варианти после.
- В `SECTION_DEFS` (`lib/sections.ts`): label „Бюлетин (имейл)", икона.
- Storefront компонент (`sections/newsletter.tsx`): заглавие + текст + поле за
  имейл + бутон „Абонирай се" + honeypot. Client, `useActionState`.
- В `renderSections` — участва в тоналния ритъм.

**Double opt-in поток:**
1. Клиент въвежда имейл → публичен action `subscribeToNewsletter(shopSlug, formData)`:
   - Zod (`email`, honeypot `website`) + `checkRateLimit('sub:{ip}:{shopId}', 5, 3600)`.
   - `onConflictDoUpdate` по `(shopId, email)`: нов → `status='pending'` + нов
     `token`; съществуващ `confirmed` → връща „вече си абониран" (без нов имейл);
     съществуващ `pending` → нов token + повторен имейл.
   - Resend имейл за потвърждение: линк
     `/s/{slug}/newsletter/confirm?token=...`.
2. **Потвърждение** — route `/s/[slug]/newsletter/confirm` (page, чете `token`):
   - Валиден pending token → `status='confirmed'`, `confirmedAt=now()` →
     „Абонаментът е потвърден!".
   - Вече confirmed → „Вече си абониран".
   - Невалиден/непознат token → „Линкът е невалиден или изтекъл".
3. **Отписване** — същият route с `?action=unsubscribe` → `status='unsubscribed'`.
   Всеки newsletter имейл съдържа линк за отписване.

**Dashboard таб „Абонати"** (`/dashboard/subscribers`, `src/actions/subscribers.ts`):
- `requireShop()` → списък `confirmed` абонати (имейл, дата) по подразбиране +
  брояч. Пагинация ако станат много.
- Бутон **„Изтегли CSV"** — server action генерира CSV (email, дата на
  потвърждение) от confirmed абонатите на този магазин; download в браузъра.
- Empty state „Още няма абонати — добави секция „Бюлетин" на сайта си."
- Нов линк в dashboard навигацията.

---

## Грешки

- Публичните endpoint-и → общи BG съобщения, никакви stack traces.
- Липсващ Resend ключ: контакт → fail „опитай по-късно"; newsletter → записва
  pending, логва warning (абонатът се потвърждава при следващ опит).
- Дубликат newsletter имейл: `confirmed` → „вече си абониран"; `pending` → нов
  потвърждаващ имейл (`onConflictDoUpdate`, без втори ред).
- Невалиден/изтекъл token → дружелюбна страница „линкът е невалиден".
- Rate limit достигнат → „твърде много заявки, опитай по-късно".
- Мулти-тенант: всички subscriber заявки филтрирани по `shopId`; CSV само на
  собствения магазин (`requireShop`).

## Тестване

- **Unit:** Zod схемите (contact + newsletter), CSV генерацията, token
  валидацията/статус преходите.
- **E2e (по желание):** контакт submit → success; newsletter subscribe →
  pending → confirm по token → confirmed.
- **Ръчно:** реален имейл (контакт до shop.email + потвърждение до клиента),
  CSV изтегляне, отписване.

## Ред на имплементация

1. **Контактна форма** — по-проста (без таблица): схема → action → ContactForm
   → /contact. `pnpm check`.
2. **Newsletter** — таблица (`db:push`) → секция + компонент → subscribe action
   → confirm/unsubscribe route → таб „Абонати" + CSV. `pnpm check`.

Всеки минава `pnpm check` преди следващия. Гейт накрая + инструкции за тестване.
БЕЗ commit до одобрение от потребителя.
