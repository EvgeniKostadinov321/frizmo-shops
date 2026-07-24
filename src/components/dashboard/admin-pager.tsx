import Link from "next/link";

/** Прост pager за админ табовете (сървърна пагинация през URL параметър). */
export function AdminPager({
  page,
  total,
  pageSize,
  paramName,
  baseParams,
}: {
  page: number;
  total: number;
  pageSize: number;
  /** Името на URL параметъра за страницата (напр. "userPage"). */
  paramName: string;
  /** Другите параметри, които трябва да се запазят (напр. "tab=users"). */
  baseParams: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const href = (p: number) => `/admin?${baseParams}&${paramName}=${p}`;

  return (
    <div className="flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link className="text-brand-600 hover:underline" href={href(page - 1)}>
          ← Предишна
        </Link>
      ) : (
        <span />
      )}
      <span className="text-ink-500">
        Страница {page} от {totalPages}
      </span>
      {page < totalPages ? (
        <Link className="text-brand-600 hover:underline" href={href(page + 1)}>
          Следваща →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
