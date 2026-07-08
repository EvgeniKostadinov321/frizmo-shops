"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon, TransitionLink } from "@/components/ui";
import { PriceStockFilter } from "@/components/price-stock-filter";

export interface ToolbarCategory {
  id: string;
  name: string;
  parentId: string | null;
}

interface SortOption {
  value: string;
  label: string;
}

interface ProductToolbarProps {
  base: string;
  /** Текущи searchParams (за скритите полета във формите + активни състояния). */
  sp: {
    search?: string;
    category?: string;
    sort?: string;
    min?: string;
    max?: string;
    inStock?: string;
  };
  sort: string;
  inStock: boolean;
  sortOptions: SortOption[];
  /** Всички категории на магазина (с parentId за йерархията в dropdown-а). */
  categories: ToolbarCategory[];
}

interface DropdownOption {
  value: string;
  label: string;
  /** Подкатегория → отстъп в панела. */
  indent?: boolean;
}

/**
 * Custom themed dropdown (--sf-* токени) — не native select (той не се
 * стилизира отвътре). Бутон + панел; при избор вика onChoose със стойността.
 * Ползва се и за подредба, и за категории.
 */
function ThemedDropdown({
  label,
  options,
  value,
  onChoose,
  pending,
  minWidth = "10rem",
}: {
  label: string;
  options: DropdownOption[];
  value: string;
  onChoose: (value: string) => void;
  pending?: boolean;
  minWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeLabel = options.find((o) => o.value === value)?.label ?? options[0]?.label;

  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-xs uppercase tracking-[0.14em] text-(--sf-muted)">{label}</span>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={pending}
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 items-center gap-2 rounded-full border border-(--sf-border) bg-(--sf-surface-raised) pl-3.5 pr-3 text-sm text-(--sf-text) transition-colors hover:border-(--sf-primary) disabled:opacity-60"
        >
          <span className="max-w-40 truncate">{activeLabel}</span>
          <Icon
            name="chevron-down"
            size={16}
            className={`shrink-0 text-(--sf-muted) transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <ul
            role="listbox"
            style={{ minWidth }}
            className="absolute left-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-2xl border border-(--sf-border) bg-(--sf-surface-raised) py-1 shadow-(--sf-shadow-hover)"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setOpen(false);
                      onChoose(opt.value);
                    }}
                    className={`flex w-full items-center whitespace-nowrap py-2 pr-4 text-left text-sm transition-colors ${
                      opt.indent ? "pl-8" : "pl-4"
                    } ${
                      active
                        ? "bg-(--sf-primary) font-medium text-(--sf-on-primary)"
                        : "text-(--sf-text) hover:bg-(--sf-surface)"
                    }`}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Storefront филтърна лента. Десктоп: категории + цена/наличност inline.
 * Мобилно: категориите остават, а подредба + цена/наличност се скриват зад
 * filter икона (drawer). Ценовите полета са в native GET форма (без JS submit).
 */
export function StorefrontProductToolbar({
  base,
  sp,
  sort,
  inStock,
  sortOptions,
  categories,
}: ProductToolbarProps) {
  const roots = categories.filter((c) => c.parentId === null);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const [navPending, startNav] = useTransition();

  function chooseSort(value: string) {
    startNav(() => router.push(pageUrl({ sort: value === "new" ? undefined : value, page: undefined })));
  }

  function chooseCategory(value: string) {
    startNav(() => router.push(pageUrl({ category: value || undefined, page: undefined })));
  }

  /* URL билдър — client-side (функция не може да мине граница server→client,
     затова живее ТУК, а не се подава от страницата). Пази текущите филтри. */
  function pageUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      search: sp.search,
      category: sp.category,
      min: sp.min,
      max: sp.max,
      inStock: inStock ? "1" : undefined,
      sort: sp.sort,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== "new") params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `${base}/products?${qs}` : `${base}/products`;
  }

  /* Брой активни „скрити" филтри (за badge на мобилната икона): цена + наличност
     + не-дефолтна подредба. */
  const activeCount =
    (sp.min ? 1 : 0) + (sp.max ? 1 : 0) + (inStock ? 1 : 0) + (sort !== "new" ? 1 : 0);

  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  /* Категориите като dropdown — „Всички" + корени + подкатегории (с отстъп). */
  const categoryOptions: DropdownOption[] = [
    { value: "", label: "Всички категории" },
    ...roots.flatMap((r) => {
      const kids = childrenOf(r.id);
      return [
        { value: r.id, label: r.name },
        ...kids.map((c) => ({ value: c.id, label: c.name, indent: true })),
      ];
    }),
  ];
  const categoryDropdown = roots.length > 0 && (
    <ThemedDropdown
      label="Категория"
      options={categoryOptions}
      value={sp.category ?? ""}
      onChoose={chooseCategory}
      pending={navPending}
      minWidth="12rem"
    />
  );

  const sortDropdown = (
    <ThemedDropdown
      label="Подреди"
      options={sortOptions}
      value={sort}
      onChoose={chooseSort}
      pending={navPending}
    />
  );

  /* stacked → вертикален (drawer); иначе хоризонтален (десктоп inline). */
  const priceForm = (stacked: boolean) => (
    <form
      action={`${base}/products`}
      className={stacked ? "flex flex-col gap-3" : "flex items-center gap-3"}
      aria-label="Филтър по цена и наличност"
    >
      {sp.search && <input type="hidden" name="search" value={sp.search} />}
      {sp.category && <input type="hidden" name="category" value={sp.category} />}
      {sp.sort && sp.sort !== "new" && <input type="hidden" name="sort" value={sp.sort} />}
      <PriceStockFilter
        variant="storefront"
        stacked={stacked}
        defaultMin={sp.min}
        defaultMax={sp.max}
        defaultInStock={inStock}
      />
      <div className={`flex items-center gap-3 ${stacked ? "pt-1" : ""}`}>
        <button
          type="submit"
          className={`flex h-9 items-center justify-center rounded-full border border-(--sf-border) bg-(--sf-surface-raised) px-4 text-sm text-(--sf-text) transition-colors hover:border-(--sf-primary) ${
            stacked ? "flex-1" : ""
          }`}
        >
          Приложи
        </button>
        {(sp.min || sp.max || inStock) && (
          <TransitionLink
            href={pageUrl({ min: undefined, max: undefined, inStock: undefined, page: undefined })}
            className="text-sm text-(--sf-muted) underline hover:text-(--sf-text)"
          >
            Изчисти
          </TransitionLink>
        )}
      </div>
    </form>
  );

  return (
    <div className="mb-8">
      {/* Десктоп: категория + подредба + цена/наличност — всичко на един ред.
          flex-wrap за много тесни десктоп ширини, но с компактни полета рядко
          се стига до пренасяне. */}
      <div className="hidden flex-wrap items-center gap-x-5 gap-y-3 lg:flex-nowrap sm:flex">
        {categoryDropdown}
        {sortDropdown}
        {priceForm(false)}
      </div>

      {/* Мобилно: категория dropdown + filter икона (подредба + цена в drawer) */}
      <div className="flex items-center gap-2 sm:hidden">
        {categoryDropdown ?? <span className="flex-1" />}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Подредба и филтри"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-(--sf-border) bg-(--sf-surface-raised) text-(--sf-text) transition-colors hover:border-(--sf-primary)"
        >
          <Icon name="filter" size={16} />
          {activeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-(--sf-primary) px-1 text-[10px] font-bold leading-4 text-(--sf-on-primary)">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Мобилен drawer: подредба + цена/наличност */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-(--sf-bg) sm:hidden">
          <div className="flex h-16 items-center justify-between border-b border-(--sf-border) px-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-muted)">
              Филтри
            </span>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Затвори"
              className="flex size-11 items-center justify-center rounded-full text-(--sf-text) hover:opacity-70"
            >
              <Icon name="x" size={22} />
            </button>
          </div>
          <div className="flex flex-col gap-6 overflow-y-auto p-4">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-(--sf-text)">Подредба</p>
              {sortDropdown}
            </div>
            <div className="flex flex-col gap-3 border-t border-(--sf-border) pt-4">
              <p className="text-sm font-medium text-(--sf-text)">Цена и наличност</p>
              {priceForm(true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
