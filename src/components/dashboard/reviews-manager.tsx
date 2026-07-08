"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { approveReview, deleteReview } from "@/actions/reviews";
import { Stars } from "@/components/storefront/stars";
import type { Review } from "@/db";
import { Badge, Button, ConfirmDialog, EmptyState } from "@/components/ui";

const dateFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

interface ReviewsManagerProps {
  items: (Review & { productName: string; productSlug: string })[];
  shopSlug: string;
  statusFilter: string;
}

/** S1: модерация на ревюта — одобри (става публично) / изтрий. */
export function ReviewsManager({ items, shopSlug, statusFilter }: ReviewsManagerProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Review | null>(null);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      const result = await approveReview({ id });
      if (!result.ok) toast.error(result.error);
      else toast.success("Ревюто е публикувано.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    const result = await deleteReview({ id: toDelete.id });
    if (!result.ok) toast.error(result.error);
    else toast.success("Ревюто е изтрито.");
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="star"
        title={statusFilter ? "Няма ревюта с този статус" : "Още няма ревюта"}
        description="Ревютата от клиентите на магазина ще се появяват тук за одобрение."
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((review) => (
          <li
            key={review.id}
            className="flex flex-col gap-2 rounded-card border border-surface-200 bg-surface-0 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-warning-600">
                <Stars rating={review.rating} size={15} />
              </span>
              <span className="font-medium text-ink-900">{review.authorName}</span>
              <span className="text-xs text-ink-500">{dateFormat.format(review.createdAt)}</span>
              <Badge tone={review.status === "approved" ? "success" : "warning"}>
                {review.status === "approved" ? "Публикувано" : "Чака одобрение"}
              </Badge>
              <span className="flex-1" />
              <Link
                href={`/s/${shopSlug}/p/${review.productSlug}`}
                target="_blank"
                className="max-w-48 truncate text-sm text-brand-600 hover:text-brand-700 hover:underline"
              >
                {review.productName}
              </Link>
            </div>

            {review.text && <p className="text-sm leading-relaxed text-ink-700">{review.text}</p>}

            <div className="flex gap-2">
              {review.status === "pending" && (
                <Button
                  size="sm"
                  loading={busyId === review.id}
                  onClick={() => handleApprove(review.id)}
                >
                  Одобри
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="text-danger-600"
                onClick={() => setToDelete(review)}
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
        message={`Изтриване на ревюто от „${toDelete?.authorName}“? Действието е необратимо.`}
      />
    </>
  );
}
