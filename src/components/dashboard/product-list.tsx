"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { bulkProductAction, deleteProduct, toggleProductStatus } from "@/actions/products";
import type { Product } from "@/db";
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Icon,
  Input,
  LinkButton,
  Select,
  SelectCheckbox,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
} from "@/components/ui";
import { formatPrice, toCents } from "@/lib/money";
import { count, NOUNS } from "@/lib/plural";
import { publicImageUrl } from "@/lib/storage";

interface ProductListProps {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  categories: { value: string; label: string }[];
  /** CSV експорт/импорт — inline на десктоп, в filter drawer-а на мобилно. */
  csvTools?: React.ReactNode;
}

export function ProductList({ items, total, page, pageSize, categories, csvTools }: ProductListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* S7 bulk: селекция (id-та от текущата страница) + action лента */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [pricePanelOpen, setPricePanelOpen] = useState(false);
  const [priceMode, setPriceMode] = useState<"percent" | "fixed">("percent");
  const [priceValueStr, setPriceValueStr] = useState("");
  /* Мобилно: категория/статус/CSV зад filter икона (drawer). */
  const [filtersOpen, setFiltersOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [navPending, startNavTransition] = useTransition();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    startNavTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  /* Търсене с debounce през URL-а */
  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (search === current) return;
    const timer = setTimeout(() => setParam("search", search), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleToggle(product: Product) {
    setTogglingId(product.id);
    try {
      const result = await toggleProductStatus({ id: product.id });
      if (!result.ok) toast.error(result.error);
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    /* ConfirmDialog показва spinner на бутона по време на await-а. */
    const result = await deleteProduct({ id: toDelete.id });
    if (!result.ok) toast.error(result.error);
    else toast.success("Продуктът е изтрит.");
    router.refresh();
  }

  const categoryLabels = new Map(categories.map((c) => [c.value, c.label]));
  const lowStockFilter = searchParams.get("stock") === "low";

  const allSelected = items.length > 0 && items.every((p) => selected.has(p.id));

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((p) => p.id)));
  }

  /* Стойност за bulk цена: percent → цяло число ±, fixed → ± центове (toCents). */
  function parsePriceValue(): number | null {
    const raw = priceValueStr.trim();
    if (!raw) return null;
    const negative = raw.startsWith("-");
    const abs = raw.replace(/^[+-]/, "");
    if (priceMode === "percent") {
      if (!/^\d+$/.test(abs)) return null;
      const n = Number(abs);
      return negative ? -n : n;
    }
    const cents = toCents(abs);
    if (cents === null) return null;
    return negative ? -cents : cents;
  }

  async function runBulk(op: { type: string; mode?: string; value?: number }) {
    setBulkBusy(true);
    try {
      const result = await bulkProductAction({ ids: [...selected], op });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { affected, promosCleared = 0, dealsCleared = 0 } = result.data;
      const cleared = promosCleared + dealsCleared;
      const base = `Готово — ${count(affected, NOUNS.product)}.`;
      if (cleared > 0) {
        /* Не тиха загуба: казваме колко промоции паднаха. Причастието
           „премахната/и" се съгласува по число с промоция (ж.р.). */
        const verb = cleared === 1 ? "Премахната" : "Премахнати";
        toast.success(
          `${base} ${verb} ${count(cleared, NOUNS.promo)} — промо цената вече е по-висока от новата.`,
        );
      } else {
        toast.success(base);
      }
      setSelected(new Set());
      setPricePanelOpen(false);
      setPriceValueStr("");
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  /* Складов badge: 0 = изчерпан, 1–3 = нисък; null (не следи) и >3 → без badge. */
  function stockBadge(stock: number | null) {
    if (stock === null || stock > 3) return null;
    return stock === 0 ? (
      <Badge tone="danger">Изчерпан</Badge>
    ) : (
      <Badge tone="warning">Нисък склад</Badge>
    );
  }

  const categoryValue = searchParams.get("category") ?? "";
  const statusValue = searchParams.get("status") ?? "";
  /* Брой активни dropdown-филтри (за badge на мобилната filter икона). */
  const activeFilterCount = (categoryValue ? 1 : 0) + (statusValue ? 1 : 0);

  /* Първа опция „Всички …" (празна стойност) → връща филтъра към нулиран. */
  const categorySelect = (
    <Select
      label="Категория"
      hideLabel
      options={[{ value: "", label: "Всички категории" }, ...categories]}
      placeholder="Всички категории"
      value={categoryValue}
      onChange={(e) => setParam("category", e.target.value)}
      disabled={navPending}
    />
  );
  const statusSelect = (
    <Select
      label="Статус"
      hideLabel
      options={[
        { value: "", label: "Всички статуси" },
        { value: "active", label: "Активни" },
        { value: "inactive", label: "Неактивни" },
      ]}
      placeholder="Всички статуси"
      value={statusValue}
      onChange={(e) => setParam("status", e.target.value)}
      disabled={navPending}
    />
  );

  /* Нулира всички dropdown-филтри наведнъж (search се пази отделно). */
  function clearFilters() {
    const params = new URLSearchParams(searchParams);
    params.delete("category");
    params.delete("status");
    params.delete("page");
    startNavTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Мобилно: търсене + filter икона (drawer); десктоп: всичко inline */}
      <div className="flex gap-2 sm:grid sm:grid-cols-3 sm:gap-3">
        <div className="min-w-0 flex-1">
          <Input
            label="Търсене"
            hideLabel
            placeholder="Търси по име..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Мобилно: филтрите (категория/статус/CSV) зад икона */}
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-label="Филтри и импорт/експорт"
          className="relative flex size-11 shrink-0 items-center justify-center rounded-control border border-surface-300 bg-surface-0 text-ink-700 transition-colors hover:border-brand-500 sm:hidden"
        >
          <Icon name="filter" size={18} />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4.5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-4 text-surface-0">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Десктоп: dropdown-ите inline */}
        <div className="hidden sm:block">{categorySelect}</div>
        <div className="hidden sm:block">{statusSelect}</div>
      </div>

      {/* Активни филтри като chips + „Изчисти всички" (десктоп и мобилно) —
          всеки chip маха своя филтър, бутонът маха всички наведнъж. */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {categoryValue && (
            <button
              type="button"
              onClick={() => setParam("category", "")}
              className="inline-flex items-center gap-1.5 rounded-full border border-surface-200 bg-surface-0 py-1 pl-3 pr-2 text-xs font-medium text-ink-700 transition-colors hover:border-surface-300 hover:text-ink-900"
            >
              {categoryLabels.get(categoryValue) ?? "Категория"}
              <Icon name="x" size={13} className="text-ink-500" />
            </button>
          )}
          {statusValue && (
            <button
              type="button"
              onClick={() => setParam("status", "")}
              className="inline-flex items-center gap-1.5 rounded-full border border-surface-200 bg-surface-0 py-1 pl-3 pr-2 text-xs font-medium text-ink-700 transition-colors hover:border-surface-300 hover:text-ink-900"
            >
              {statusValue === "active" ? "Активни" : "Неактивни"}
              <Icon name="x" size={13} className="text-ink-500" />
            </button>
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Изчисти всички
          </button>
        </div>
      )}

      {/* Мобилен drawer: категория, статус, CSV */}
      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Филтри">
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-900">Категория</p>
            {categorySelect}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-900">Статус</p>
            {statusSelect}
          </div>
          {csvTools && (
            <div className="border-t border-surface-200 pt-4">
              <p className="mb-2 text-sm font-medium text-ink-900">Импорт / Експорт</p>
              {csvTools}
            </div>
          )}
        </div>
      </Drawer>

      {lowStockFilter && (
        <div className="flex items-center gap-2">
          <Badge tone="warning">Само нисък/нулев склад</Badge>
          <button
            type="button"
            onClick={() => setParam("stock", "")}
            className="text-sm text-brand-600 underline hover:text-brand-700"
          >
            Изчисти филтъра
          </button>
        </div>
      )}

      {/* S7: action лента при селекция — sticky отдолу на мобилно (bulk pattern),
          обикновена карта на десктоп. */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-200 bg-brand-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-float sm:static sm:rounded-card sm:border sm:p-3 sm:pb-3 sm:shadow-none">
          <div className="mx-auto flex max-w-7xl flex-col gap-3">
            {/* Ред 1: брояч + „откажи" */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink-900">
                Избрани: {selected.size}
              </span>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-sm font-medium text-ink-500 hover:text-ink-900"
              >
                Откажи
              </button>
            </div>

            {/* Ред 2: действията — на мобилно се разстилат равномерно (grid),
                на десктоп са в ред. */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                disabled={bulkBusy}
                onClick={() => runBulk({ type: "activate" })}
              >
                Активирай
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={bulkBusy}
                onClick={() => runBulk({ type: "deactivate" })}
              >
                Деактивирай
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={bulkBusy}
                onClick={() => setPricePanelOpen((o) => !o)}
              >
                Промяна на цени
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={bulkBusy}
                className="text-danger-600"
                onClick={() => setConfirmBulkDelete(true)}
              >
                Изтрий
              </Button>
            </div>

          {pricePanelOpen && (
            <div className="flex flex-wrap items-end gap-3 border-t border-brand-200 pt-3">
              <div className="w-40">
                <Select
                  label="Режим"
                  options={[
                    { value: "percent", label: "± процент" },
                    { value: "fixed", label: "± сума (EUR)" },
                  ]}
                  value={priceMode}
                  onChange={(e) => setPriceMode(e.target.value as "percent" | "fixed")}
                />
              </div>
              <div className="w-36">
                <Input
                  label="Стойност"
                  placeholder={priceMode === "percent" ? "напр. 10 или -5" : "напр. 2,50 или -1"}
                  value={priceValueStr}
                  onChange={(e) => setPriceValueStr(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                loading={bulkBusy}
                disabled={parsePriceValue() === null}
                onClick={() => {
                  const value = parsePriceValue();
                  if (value === null) return;
                  runBulk({ type: "price", mode: priceMode, value });
                }}
              >
                Приложи
              </Button>
              <p className="basis-full text-xs text-ink-500">
                Прилага се върху редовната цена (минимум 0,01 €). Промо цена, станала
                по-висока от новата редовна, се премахва.
              </p>
            </div>
          )}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon="store"
          title={total === 0 && !searchParams.toString() ? "Още нямаш продукти" : "Няма резултати"}
          description="Добави продукт и той ще се появи тук."
          action={<LinkButton href="/dashboard/products/new">Добави продукт</LinkButton>}
        />
      ) : (
        <div
          aria-busy={navPending || undefined}
          className={navPending ? "opacity-60 transition-opacity" : "transition-opacity"}
        >
          {/* Мобилно: карти (таблицата е за десктоп) */}
          <ul className="flex flex-col gap-3 md:hidden">
            {items.map((product) => (
              <li
                key={product.id}
                className="flex gap-3 rounded-card border border-surface-200 bg-surface-0 p-3"
              >
                <span className="shrink-0 self-center">
                  <SelectCheckbox
                    aria-label={`Избери „${product.name}“`}
                    checked={selected.has(product.id)}
                    onChange={() => toggleSelected(product.id)}
                  />
                </span>
                <Link
                  href={`/dashboard/products/${product.id}`}
                  className="relative size-16 shrink-0 overflow-hidden rounded-control border border-surface-200 bg-surface-50"
                >
                  {product.images[0] ? (
                    <Image
                      src={publicImageUrl(product.images[0])}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-surface-300">
                      <Icon name="image" size={24} />
                    </span>
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`/dashboard/products/${product.id}`}
                    className="truncate font-medium text-ink-900 hover:text-brand-600"
                  >
                    {product.name}
                  </Link>
                  <span className="text-xs text-ink-500">
                    {product.categoryId ? (categoryLabels.get(product.categoryId) ?? "—") : "Без категория"}
                  </span>
                  <span className="text-sm font-medium text-ink-900">
                    {product.promoPriceCents !== null ? (
                      <>
                        <span className="text-danger-600">{formatPrice(product.promoPriceCents)}</span>{" "}
                        <s className="text-xs text-ink-500">{formatPrice(product.priceCents)}</s>
                      </>
                    ) : (
                      formatPrice(product.priceCents)
                    )}
                    <span className="text-ink-500"> · {product.stock ?? "—"} бр.</span>
                  </span>
                  {stockBadge(product.stock) && (
                    <span className="mt-0.5">{stockBadge(product.stock)}</span>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggle(product)}
                      disabled={togglingId === product.id}
                      aria-label="Смени статуса"
                      className={togglingId === product.id ? "opacity-50" : ""}
                    >
                      <Badge tone={product.status === "active" ? "success" : "neutral"}>
                        {product.status === "active" ? "Активен" : "Неактивен"}
                      </Badge>
                    </button>
                    <span className="flex-1" />
                    <Link href={`/dashboard/products/${product.id}`}>
                      <Button variant="ghost" size="sm" aria-label="Редактирай">
                        <Icon name="pencil" size={18} />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Изтрий"
                      onClick={() => setToDelete(product)}
                    >
                      <Icon name="trash" size={18} />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Десктоп: таблица */}
          <Table className="hidden md:block">
            <THead>
              <TH>
                <SelectCheckbox
                  aria-label="Избери всички на страницата"
                  checked={allSelected}
                  indeterminate={selected.size > 0 && !allSelected}
                  onChange={toggleAll}
                />
              </TH>
              <TH>Продукт</TH>
              <TH>Категория</TH>
              <TH>Цена</TH>
              <TH>Наличност</TH>
              <TH>Статус</TH>
              <TH aria-label="Действия" />
            </THead>
            <TBody>
              {items.map((product) => (
                <TRow key={product.id}>
                  <TCell>
                    <SelectCheckbox
                      aria-label={`Избери „${product.name}“`}
                      checked={selected.has(product.id)}
                      onChange={() => toggleSelected(product.id)}
                    />
                  </TCell>
                  <TCell>
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="flex items-center gap-3 font-medium hover:text-brand-600"
                    >
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-control border border-surface-200 bg-surface-50">
                        {product.images[0] ? (
                          <Image
                            src={publicImageUrl(product.images[0])}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center text-surface-300">
                            <Icon name="image" size={20} />
                          </span>
                        )}
                      </span>
                      <span className="max-w-56 truncate">{product.name}</span>
                    </Link>
                  </TCell>
                  <TCell className="text-ink-500">
                    {product.categoryId ? (categoryLabels.get(product.categoryId) ?? "—") : "—"}
                  </TCell>
                  <TCell>
                    <div className="flex flex-col">
                      <span>
                        {product.promoPriceCents !== null ? (
                          <span>
                            <span className="font-medium text-danger-600">
                              {formatPrice(product.promoPriceCents)}
                            </span>{" "}
                            <s className="text-xs text-ink-500">{formatPrice(product.priceCents)}</s>
                          </span>
                        ) : (
                          formatPrice(product.priceCents)
                        )}
                      </span>
                      {product.costCents != null && product.priceCents > 0 && (
                        <span className="text-xs text-ink-500">
                          Марж:{" "}
                          {Math.round(
                            ((product.priceCents - product.costCents) / product.priceCents) * 100,
                          )}
                          %
                        </span>
                      )}
                    </div>
                  </TCell>
                  <TCell>
                    <span className="flex items-center gap-2">
                      {product.stock ?? "—"}
                      {stockBadge(product.stock)}
                    </span>
                  </TCell>
                  <TCell>
                    <button
                      type="button"
                      onClick={() => handleToggle(product)}
                      disabled={togglingId === product.id}
                      aria-label="Смени статуса"
                      className={togglingId === product.id ? "opacity-50" : ""}
                    >
                      <Badge tone={product.status === "active" ? "success" : "neutral"}>
                        {product.status === "active" ? "Активен" : "Неактивен"}
                      </Badge>
                    </button>
                  </TCell>
                  <TCell>
                    <div className="flex justify-end gap-1">
                      <Link href={`/dashboard/products/${product.id}`}>
                        <Button variant="ghost" size="sm" aria-label="Редактирай">
                          <Icon name="pencil" size={18} />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Изтрий"
                        onClick={() => setToDelete(product)}
                      >
                        <Icon name="trash" size={18} />
                      </Button>
                    </div>
                  </TCell>
                </TRow>
              ))}
            </TBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || navPending}
                onClick={() => setParam("page", String(page - 1))}
              >
                ← Предишна
              </Button>
              <span className="text-sm text-ink-500">
                Страница {page} от {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || navPending}
                onClick={() => setParam("page", String(page + 1))}
              >
                Следваща →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Spacer под съдържанието когато sticky bulk лентата е активна (мобилно),
          за да не крие последния ред. */}
      {selected.size > 0 && <div aria-hidden className="h-24 sm:hidden" />}

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        message={`Изтриване на „${toDelete?.name}“? Действието е необратимо, снимките също ще бъдат изтрити.`}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={async () => {
          setConfirmBulkDelete(false);
          await runBulk({ type: "delete" });
        }}
        message={`Изтриване на ${selected.size} ${selected.size === 1 ? "продукт" : "продукта"}? Действието е необратимо, снимките също ще бъдат изтрити.`}
      />
    </div>
  );
}
