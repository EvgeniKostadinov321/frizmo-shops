"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  createCategory,
  deleteCategory,
  moveCategory,
  updateCategory,
} from "@/actions/categories";
import type { CategoryNode, CategoryWithCount } from "@/db/queries/categories";
import {
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Icon,
  Input,
  Select,
} from "@/components/ui";

interface CategoriesManagerProps {
  tree: CategoryNode[];
}

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; category: CategoryWithCount };

export function CategoriesManager({ tree }: CategoriesManagerProps) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [toDelete, setToDelete] = useState<CategoryWithCount | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [saving, setSaving] = useState(false);
  /* Коя категория има текущо действие (местене) — за spinner на бутона. */
  const [pending, setPending] = useState<{ id: string; dir: "up" | "down" } | null>(null);

  const parentOptions = tree.map((c) => ({ value: c.id, label: c.name }));

  function openCreate() {
    setName("");
    setParentId("");
    setNameError(undefined);
    setEditor({ mode: "create" });
  }

  function openEdit(category: CategoryWithCount) {
    setName(category.name);
    setNameError(undefined);
    setEditor({ mode: "edit", category });
  }

  async function save() {
    setSaving(true);
    try {
      const result =
        editor.mode === "create"
          ? await createCategory({ name, parentId })
          : editor.mode === "edit"
            ? await updateCategory({ id: editor.category.id, name })
            : null;
      if (!result) return;

      if (!result.ok) {
        setNameError(result.fieldErrors?.name);
        if (!result.fieldErrors?.name) toast.error(result.error);
        return;
      }
      toast.success(editor.mode === "create" ? "Категорията е създадена." : "Запазено.");
      setEditor({ mode: "closed" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setPending({ id, dir: direction });
    try {
      const result = await moveCategory({ id, direction });
      if (!result.ok) toast.error(result.error);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    const result = await deleteCategory({ id: toDelete.id });
    if (!result.ok) toast.error(result.error);
    else toast.success("Категорията е изтрита.");
    router.refresh();
  }

  function CategoryRow({
    category,
    depth,
  }: {
    category: CategoryWithCount;
    depth: number;
  }) {
    return (
      <div
        className={`flex items-center justify-between gap-2 border-b border-surface-100 py-2 last:border-0 ${
          depth > 0 ? "pl-8" : ""
        }`}
      >
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">
            {depth > 0 && <span className="text-ink-500">↳ </span>}
            {category.name}
          </p>
          <p className="text-xs text-ink-500">
            {category.productCount === 1 ? "1 продукт" : `${category.productCount} продукта`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Премести нагоре"
            loading={pending?.id === category.id && pending.dir === "up"}
            disabled={pending !== null}
            onClick={() => handleMove(category.id, "up")}
          >
            <Icon name="arrow-up" size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Премести надолу"
            loading={pending?.id === category.id && pending.dir === "down"}
            disabled={pending !== null}
            onClick={() => handleMove(category.id, "down")}
          >
            <Icon name="arrow-down" size={18} />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Редактирай" onClick={() => openEdit(category)}>
            <Icon name="pencil" size={18} />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Изтрий" onClick={() => setToDelete(category)}>
            <Icon name="trash" size={18} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-900">Категории</h1>
        <Button onClick={openCreate}>Добави категория</Button>
      </div>

      {tree.length === 0 ? (
        <EmptyState
          icon="palette"
          title="Още нямаш категории"
          description="Категориите помагат на клиентите да намират продуктите ти по-лесно. Пример: „Млечни продукти“ с подкатегория „Сирена“."
          action={<Button onClick={openCreate}>Създай първата</Button>}
        />
      ) : (
        <div className="rounded-card border border-surface-200 bg-surface-0 px-4">
          {tree.map((root) => (
            <div key={root.id}>
              <CategoryRow category={root} depth={0} />
              {root.children.map((child) => (
                <CategoryRow key={child.id} category={child} depth={1} />
              ))}
            </div>
          ))}
        </div>
      )}

      <Drawer
        open={editor.mode !== "closed"}
        onClose={() => setEditor({ mode: "closed" })}
        title={editor.mode === "edit" ? "Редактирай категория" : "Нова категория"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditor({ mode: "closed" })}>
              Отказ
            </Button>
            <Button onClick={save} loading={saving}>
              Запази
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Име"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameError}
          />
          {editor.mode === "create" && (
            <Select
              label="Родителска категория"
              options={parentOptions}
              placeholder="— Без родител —"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              hint="Максимум едно ниво подкатегории."
            />
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        message={`Изтриване на „${toDelete?.name}"? Продуктите в нея ще останат без категория, а подкатегориите ѝ ще станат основни.`}
      />
    </div>
  );
}
