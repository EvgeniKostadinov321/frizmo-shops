/**
 * Лек loading индикатор при навигация между storefront страниците (те са
 * SSR/dynamic). Неутрален спрямо темата — показва се преди настройките да са
 * заредени. Не пречи на owner preview: показва се при навигация, не при
 * router.refresh() на вече рендерирана страница.
 */
export default function StorefrontLoading() {
  return (
    <div
      role="status"
      aria-label="Зареждане"
      className="flex min-h-[60vh] items-center justify-center"
    >
      <span className="size-8 animate-spin rounded-full border-2 border-current border-t-transparent text-ink-400" />
    </div>
  );
}
