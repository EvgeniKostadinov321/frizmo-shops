"use client";

import { Button, Icon, Input } from "@/components/ui";
import type { SiteSettings } from "@/schemas/site-settings";

type NavLink = SiteSettings["navLinks"][number];

interface NavLinksEditorProps {
  links: NavLink[];
  onChange: (links: NavLink[]) => void;
}

const MAX = 8;

/**
 * Редактор на ръчните навигационни линкове. Те се ДОБАВЯТ към авто менюто
 * (категории + страници). Пренареждане със стрелки (max 8 → без нужда от dnd).
 * Празно = само авто менюто.
 */
export function NavLinksEditor({ links, onChange }: NavLinksEditorProps) {
  function update(id: string, patch: Partial<NavLink>) {
    onChange(links.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function remove(id: string) {
    onChange(links.filter((l) => l.id !== id));
  }
  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    const item = next[index]!;
    next[index] = next[target]!;
    next[target] = item;
    onChange(next);
  }
  function add() {
    onChange([...links, { id: crypto.randomUUID(), label: "", href: "" }]);
  }

  return (
    <div className="flex flex-col gap-3">
      {links.length === 0 && (
        <p className="text-sm text-ink-500">
          Менюто се сглобява автоматично от категориите и страниците ти. Добави
          линк тук, за да сложиш и свой (напр. блог, промоция, външна страница).
        </p>
      )}

      {links.map((link, i) => (
        <div key={link.id} className="flex items-start gap-2 rounded-control border border-surface-200 p-3">
          <div className="flex flex-1 flex-col gap-2">
            <Input
              label="Текст"
              hideLabel
              placeholder="Текст (напр. Промоции)"
              value={link.label}
              onChange={(e) => update(link.id, { label: e.target.value })}
            />
            <Input
              label="Линк"
              hideLabel
              placeholder="/products?category=… или https://…"
              value={link.href}
              onChange={(e) => update(link.id, { href: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              aria-label="Нагоре"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="flex size-8 items-center justify-center rounded-control text-ink-500 transition-colors hover:bg-surface-100 disabled:opacity-40"
            >
              <Icon name="arrow-up" size={16} />
            </button>
            <button
              type="button"
              aria-label="Надолу"
              onClick={() => move(i, 1)}
              disabled={i === links.length - 1}
              className="flex size-8 items-center justify-center rounded-control text-ink-500 transition-colors hover:bg-surface-100 disabled:opacity-40"
            >
              <Icon name="arrow-down" size={16} />
            </button>
            <button
              type="button"
              aria-label="Премахни"
              onClick={() => remove(link.id)}
              className="flex size-8 items-center justify-center rounded-control text-ink-500 transition-colors hover:bg-surface-100"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
      ))}

      {links.length < MAX && (
        <div>
          <Button variant="secondary" size="sm" onClick={add}>
            <Icon name="plus" size={15} className="-ml-0.5" />
            Добави линк
          </Button>
        </div>
      )}
    </div>
  );
}
