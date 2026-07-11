"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { answerQuestion, deleteQuestion } from "@/actions/questions";
import { Badge, Button, ConfirmDialog, EmptyState, Icon, Textarea } from "@/components/ui";
import type { ShopQuestion } from "@/db/queries/questions";

const dateFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function QuestionsManager({ items, shopSlug }: { items: ShopQuestion[]; shopSlug: string }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ShopQuestion | null>(null);

  async function handleAnswer(id: string, current: string) {
    const answer = (drafts[id] ?? current).trim();
    if (!answer) {
      toast.error("Въведи отговор.");
      return;
    }
    setBusyId(id);
    try {
      const result = await answerQuestion({ id, answer });
      if (!result.ok) toast.error(result.error);
      else toast.success("Отговорът е публикуван.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    const result = await deleteQuestion({ id: toDelete.id });
    if (!result.ok) toast.error(result.error);
    else toast.success("Въпросът е изтрит.");
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="help-circle"
        title="Още няма въпроси"
        description="Въпросите от клиентите на магазина ще се появяват тук за отговор."
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((q) => (
          <li
            key={q.id}
            className="flex flex-col gap-2 rounded-card border border-surface-200 bg-surface-0 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink-900">{q.askerName || "Купувач"}</span>
              <span className="text-xs text-ink-500">{dateFormat.format(q.createdAt)}</span>
              <Badge tone={q.status === "answered" ? "success" : "warning"}>
                {q.status === "answered" ? "Публикуван" : "Чака отговор"}
              </Badge>
              <span className="flex-1" />
              <Link
                href={`/s/${shopSlug}/p/${q.productSlug}`}
                target="_blank"
                className="max-w-48 truncate text-sm text-brand-600 hover:text-brand-700 hover:underline"
              >
                {q.productName}
              </Link>
            </div>

            <p className="flex items-baseline gap-2 text-sm text-ink-900">
              <Icon name="help-circle" size={15} className="shrink-0 text-brand-600" />
              {q.question}
            </p>

            <Textarea
              label="Отговор"
              rows={2}
              maxLength={1000}
              defaultValue={q.answer}
              placeholder="Напиши отговор…"
              onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
            />

            <div className="flex gap-2">
              <Button size="sm" loading={busyId === q.id} onClick={() => handleAnswer(q.id, q.answer)}>
                {q.status === "answered" ? "Обнови отговора" : "Публикувай отговор"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="text-danger-600"
                onClick={() => setToDelete(q)}
              >
                Изтрий
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        message={`Изтриване на въпроса от „${toDelete?.askerName || "Купувач"}“? Действието е необратимо.`}
      />
    </>
  );
}
