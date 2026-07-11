"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";

interface Props {
  name: string;
  columns: string[];
  rows: string[][];
}

/** Публична таблица с размери — бутон отваря overlay (Modal/Drawer). Чете --sf-* токени. */
export function SizeGuideModal({ name, columns, rows }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 text-sm font-medium text-(--sf-primary) hover:underline"
      >
        <Icon name="ruler" size={16} />
        Таблица с размери
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={name}
            className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-(--sf-surface-raised) p-5 sm:rounded-(--sf-radius)"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-lg font-medium text-(--sf-text)">{name}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Затвори"
                className="flex size-9 items-center justify-center text-(--sf-muted) hover:text-(--sf-text)"
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-(--sf-border)">
                    {columns.map((c, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-(--sf-text)">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-(--sf-border) last:border-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-(--sf-muted)">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
