"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveSizeGuide } from "@/actions/size-guides";
import { Button, Icon, Input } from "@/components/ui";
import { isDirty } from "@/lib/is-dirty";

interface Props {
  initial?: { id: string; name: string; columns: string[]; rows: string[][] };
  onSaved: () => void;
}

export function SizeGuideEditor({ initial, onSaved }: Props) {
  const baseName = initial?.name ?? "";
  const baseColumns = initial?.columns ?? ["Размер"];
  const baseRows = initial?.rows ?? [[""]];
  const [name, setName] = useState(baseName);
  const [columns, setColumns] = useState<string[]>(baseColumns);
  const [rows, setRows] = useState<string[][]>(baseRows);
  const [saving, setSaving] = useState(false);
  /* Dirty: при редакция сравняваме с началните; при създаване искаме поне име. */
  const dirty = initial
    ? isDirty({ name, columns, rows }, { name: baseName, columns: baseColumns, rows: baseRows })
    : name.trim() !== "";

  function addColumn() {
    setColumns([...columns, ""]);
    setRows(rows.map((r) => [...r, ""]));
  }
  function removeColumn(ci: number) {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== ci));
    setRows(rows.map((r) => r.filter((_, i) => i !== ci)));
  }
  function addRow() {
    setRows([...rows, columns.map(() => "")]);
  }
  function removeRow(ri: number) {
    setRows(rows.filter((_, i) => i !== ri));
  }
  function setColumn(ci: number, value: string) {
    setColumns(columns.map((c, i) => (i === ci ? value : c)));
  }
  function setCell(ri: number, ci: number, value: string) {
    setRows(rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? value : c)) : r)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveSizeGuide(initial?.id ?? null, { name, columns, rows });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Таблицата е запазена.");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Input label="Име на таблицата" value={name} onChange={(e) => setName(e.target.value)} />

      {/* Заглавия на колоните — редактируеми, споделени за двата изгледа. */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-900">Колони</span>
        <div className="flex flex-wrap gap-2">
          {columns.map((c, ci) => (
            <div
              key={ci}
              className="flex items-center gap-1 rounded-control border border-surface-200 bg-surface-50 py-1 pl-2 pr-1"
            >
              <input
                aria-label={`Име на колона ${ci + 1}`}
                value={c}
                onChange={(e) => setColumn(ci, e.target.value)}
                placeholder={`Колона ${ci + 1}`}
                className="h-8 w-28 bg-transparent px-1 text-sm text-ink-900 placeholder:text-ink-500 focus:outline-none"
              />
              {columns.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeColumn(ci)}
                  aria-label={`Премахни колона ${ci + 1}`}
                  className="flex size-7 items-center justify-center rounded-control text-ink-500 hover:bg-surface-200 hover:text-danger-600"
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addColumn}>
            <Icon name="plus" size={14} />
            Колона
          </Button>
        </div>
      </div>

      {/* Редове — десктоп: подредена таблица с номера; мобилно: карти. */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-900">Редове</span>

        {/* Десктоп таблица */}
        <div className="hidden overflow-hidden rounded-card border border-surface-200 md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left text-ink-500">
                <th className="w-10 px-2 py-2 text-center font-medium">#</th>
                {columns.map((c, ci) => (
                  <th key={ci} className="px-2 py-2 font-medium">
                    {c || `Колона ${ci + 1}`}
                  </th>
                ))}
                <th className="w-12 px-2 py-2" aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-surface-200 last:border-0">
                  <td className="px-2 py-1.5 text-center text-xs text-ink-500">{ri + 1}</td>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-1.5 py-1.5">
                      <input
                        aria-label={`Ред ${ri + 1}, ${columns[ci] || `колона ${ci + 1}`}`}
                        value={cell}
                        onChange={(e) => setCell(ri, ci, e.target.value)}
                        className="h-9 w-full rounded-control border border-surface-300 bg-surface-0 px-2 text-ink-900 focus:border-brand-600 focus:outline-none"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(ri)}
                      aria-label={`Премахни ред ${ri + 1}`}
                      className="flex size-8 items-center justify-center rounded-control text-ink-500 hover:bg-surface-100 hover:text-danger-600"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Мобилни карти — по един ред на карта, полетата едно под друго. */}
        <div className="flex flex-col gap-3 md:hidden">
          {rows.map((row, ri) => (
            <div key={ri} className="rounded-card border border-surface-200 bg-surface-0 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-ink-500">Ред {ri + 1}</span>
                <button
                  type="button"
                  onClick={() => removeRow(ri)}
                  aria-label={`Премахни ред ${ri + 1}`}
                  className="flex size-8 items-center justify-center rounded-control text-ink-500 hover:bg-surface-100 hover:text-danger-600"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {row.map((cell, ci) => (
                  <Input
                    key={ci}
                    label={columns[ci] || `Колона ${ci + 1}`}
                    value={cell}
                    onChange={(e) => setCell(ri, ci, e.target.value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div>
          <Button type="button" variant="secondary" size="sm" onClick={addRow}>
            <Icon name="plus" size={14} />
            Добави ред
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-surface-200 pt-4">
        <Button type="button" loading={saving} disabled={!dirty} onClick={handleSave}>
          Запази таблицата
        </Button>
      </div>
    </div>
  );
}
