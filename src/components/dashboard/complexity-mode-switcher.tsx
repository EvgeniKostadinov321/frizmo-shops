"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { setComplexityMode } from "@/actions/shop";
import { Icon } from "@/components/ui";
import { MODE_META, type ComplexityMode } from "@/lib/complexity";

interface Props {
  mode: ComplexityMode;
  /** desktop = компактен бутон в хедъра; mobile = ред в burger менюто. */
  variant?: "desktop" | "mobile";
  /** Извиква се след успешна смяна (напр. затвори мобилното меню). */
  onChanged?: () => void;
}

export function ComplexityModeSwitcher({ mode, variant = "desktop", onChanged }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const currentLabel = MODE_META.find((m) => m.value === mode)?.label ?? "Режим";

  /* Клик извън → затвори. */
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function choose(next: ComplexityMode) {
    setOpen(false);
    if (next === mode) return;
    startTransition(async () => {
      const result = await setComplexityMode(next);
      if (!result.ok) {
        toast.error(result.error ?? "Грешка при смяна на режима.");
        return;
      }
      toast.success(`Режим: ${MODE_META.find((m) => m.value === next)?.label}`);
      onChanged?.();
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        className={
          variant === "mobile"
            ? "flex h-12 w-full items-center gap-2 rounded-control px-4 text-base font-medium text-ink-700 hover:bg-surface-100"
            : "flex h-9 items-center gap-1.5 rounded-control border border-surface-200 px-3 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-100 hover:text-ink-900"
        }
      >
        <Icon name="filter" size={16} className="text-ink-500" />
        <span className="whitespace-nowrap">
          Режим: <span className="text-ink-900">{currentLabel}</span>
        </span>
        <Icon name="chevron-down" size={14} className="text-ink-500" />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-50 mt-1 w-72 rounded-card border border-surface-200 bg-surface-0 p-1 shadow-float ${
            variant === "mobile" ? "left-0" : "right-0"
          }`}
        >
          {MODE_META.map((m) => (
            <button
              key={m.value}
              type="button"
              role="menuitemradio"
              aria-checked={m.value === mode}
              onClick={() => choose(m.value)}
              className={`flex w-full flex-col gap-0.5 rounded-control px-3 py-2 text-left transition-colors hover:bg-surface-100 ${
                m.value === mode ? "bg-surface-50" : ""
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-ink-900">
                {m.label}
                {m.value === mode && <Icon name="check" size={14} className="text-brand-600" />}
              </span>
              <span className="text-xs text-ink-500">{m.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
