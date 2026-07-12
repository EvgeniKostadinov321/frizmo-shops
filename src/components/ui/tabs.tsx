"use client";

import { Children, isValidElement, useCallback, useEffect, useId, useRef, useState } from "react";

export interface TabItem {
  key: string;
  label: string;
  /** Показва точка на таба (напр. валидационна грешка в скрит таб). */
  marker?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  children: React.ReactNode;
  /** Име на query param, default „tab". */
  paramName?: string;
  ariaLabel: string;
}

export interface TabPanelProps {
  /** Трябва да съвпада с TabItem.key. */
  tabKey: string;
  children: React.ReactNode;
}

/** Панел на един таб. Съдържанието се обвива от Tabs (активност + a11y атрибути). */
export function TabPanel({ children }: TabPanelProps) {
  return <>{children}</>;
}

function readParam(paramName: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(paramName);
}

/**
 * Презентационни табове с URL синхронизация. Активният таб живее в query param
 * (`?tab=`); смяната е плитка (history.replaceState, без re-fetch) → отворени
 * drawer-и и form state оцеляват. Всички панели са монтирани (неактивните hidden).
 */
export function Tabs({ tabs, children, paramName = "tab", ariaLabel }: TabsProps) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const validKeys = tabs.map((t) => t.key);
  /* SSR рендерира първия таб (readParam е null на сървъра); клиентът синхронизира
     от URL в effect след mount. */
  const [active, setActive] = useState<string>(tabs[0]?.key ?? "");

  useEffect(() => {
    const fromUrl = readParam(paramName);
    if (fromUrl && validKeys.includes(fromUrl)) setActive(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramName]);

  const select = useCallback(
    (key: string) => {
      setActive(key);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set(paramName, key);
        window.history.replaceState(null, "", url.toString());
      }
    },
    [paramName],
  );

  /* Активният таб се скролва в изглед (лентата е overflow-x-auto на мобилно).
     scrollIntoView липсва в jsdom и в стари среди → guard-ваме метода. */
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-key="${active}"]`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    const idx = validKeys.indexOf(active);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    const nextKey = tabs[next]!.key;
    select(nextKey);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-key="${nextKey}"]`)?.focus();
  }

  const panels = Children.toArray(children).filter(isValidElement);

  return (
    <div className="flex flex-col gap-5">
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-surface-200 scrollbar-none"
      >
        {tabs.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.key}`}
              data-key={t.key}
              data-marker={t.marker ? "true" : undefined}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.key)}
              className={`inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors ${
                selected
                  ? "border-brand-600 text-ink-900"
                  : "border-transparent text-ink-500 hover:text-ink-700"
              }`}
            >
              {t.label}
              {t.marker && (
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-danger-500" />
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t, i) => {
        const selected = t.key === active;
        return (
          <div
            key={t.key}
            role="tabpanel"
            id={`${baseId}-panel-${t.key}`}
            aria-labelledby={`${baseId}-tab-${t.key}`}
            hidden={!selected}
          >
            {panels[i]}
          </div>
        );
      })}
    </div>
  );
}
