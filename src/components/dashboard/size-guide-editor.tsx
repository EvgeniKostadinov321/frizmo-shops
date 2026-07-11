"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveSizeGuide } from "@/actions/size-guides";
import { Button, Icon, Input } from "@/components/ui";

interface Props {
  initial?: { id: string; name: string; columns: string[]; rows: string[][] };
  onSaved: () => void;
}

export function SizeGuideEditor({ initial, onSaved }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [columns, setColumns] = useState<string[]>(initial?.columns ?? ["Размер"]);
  const [rows, setRows] = useState<string[][]>(initial?.rows ?? [[""]]);
  const [saving, setSaving] = useState(false);

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
    <div className="flex flex-col gap-4">
      <Input label="Име на таблицата" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((c, ci) => (
                <th key={ci} className="p-1 align-top">
                  <div className="flex items-center gap-1">
                    <Input
                      label={`Колона ${ci + 1}`}
                      hideLabel
                      value={c}
                      onChange={(e) => setColumn(ci, e.target.value)}
                    />
                    {columns.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColumn(ci)}
                        aria-label={`Премахни колона ${ci + 1}`}
                      >
                        <Icon name="x" size={14} />
                      </Button>
                    )}
                  </div>
                </th>
              ))}
              <th className="p-1 align-top">
                <Button type="button" variant="secondary" size="sm" onClick={addColumn}>
                  <Icon name="plus" size={14} />
                  Колона
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="p-1">
                    <Input
                      label={`Ред ${ri + 1} колона ${ci + 1}`}
                      hideLabel
                      value={cell}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                    />
                  </td>
                ))}
                <td className="p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(ri)}
                    aria-label={`Премахни ред ${ri + 1}`}
                  >
                    <Icon name="trash" size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={addRow}>
          <Icon name="plus" size={14} />
          Ред
        </Button>
        <Button type="button" loading={saving} onClick={handleSave}>
          Запази
        </Button>
      </div>
    </div>
  );
}
