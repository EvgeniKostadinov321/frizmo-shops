"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteSizeGuide } from "@/actions/size-guides";
import { SizeGuideEditor } from "./size-guide-editor";
import { Button, ConfirmDialog, Drawer, EmptyState, Icon } from "@/components/ui";
import type { SizeGuide } from "@/db/queries/size-guides";

export function SizeGuidesManager({ guides }: { guides: SizeGuide[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SizeGuide | "new" | null>(null);
  const [toDelete, setToDelete] = useState<SizeGuide | null>(null);

  /* ConfirmDialog авт. вика onClose след onConfirm — не затваряй ръчно тук. */
  async function handleDelete() {
    if (!toDelete) return;
    const result = await deleteSizeGuide({ id: toDelete.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Таблицата е изтрита.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Таблици с размери</h1>
          <p className="mt-1 text-sm text-ink-500">
            Създай таблица веднъж и я закачи към много продукти.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Icon name="plus" size={16} />
          Нова таблица
        </Button>
      </div>

      {guides.length === 0 ? (
        <EmptyState
          icon="ruler"
          title="Още няма таблици с размери"
          description="Създай таблица (напр. „Дамски дрехи“) и я закачи към продукти — купувачите ще виждат размерите преди да поръчат."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-surface-200 rounded-card border border-surface-200 bg-surface-0">
          {guides.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-900">{g.name}</p>
                <p className="text-sm text-ink-500">
                  {g.columns.length} колони · {g.rows.length} реда
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(g)}>
                  <Icon name="pencil" size={14} />
                  Редактирай
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setToDelete(g)}
                  aria-label={`Изтрий ${g.name}`}
                >
                  <Icon name="trash" size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Нова таблица с размери" : "Редакция на таблица"}
      >
        {editing !== null && (
          <SizeGuideEditor
            initial={
              editing === "new"
                ? undefined
                : { id: editing.id, name: editing.name, columns: editing.columns, rows: editing.rows }
            }
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={toDelete !== null}
        title="Изтриване на таблица"
        message={`Сигурен ли си, че искаш да изтриеш „${toDelete?.name ?? ""}“? Продуктите с нея остават без таблица.`}
        confirmLabel="Изтрий"
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
