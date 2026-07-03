import { Icon } from "@/components/ui";

/**
 * Стилизиран „браузър" с мини-витрина за hero-то на landing-а.
 * Чист CSS — не остарява като скрийншот и винаги е в бранд цветовете.
 */
export function BrowserMockup() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-card border border-surface-200 bg-surface-0 shadow-xl"
    >
      {/* Браузър лента */}
      <div className="flex items-center gap-2 border-b border-surface-200 bg-surface-50 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-danger-600/60" />
          <span className="size-2.5 rounded-full bg-warning-600/60" />
          <span className="size-2.5 rounded-full bg-success-600/60" />
        </span>
        <span className="ml-2 flex-1 rounded-full bg-surface-100 px-3 py-1 text-xs text-ink-500">
          frizmoshops.bg/s/tvoyat-magazin
        </span>
      </div>

      {/* Мини витрина */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="size-6 rounded-full bg-brand-600" />
            <span className="h-2.5 w-20 rounded-full bg-ink-900/80" />
          </span>
          <span className="flex gap-2">
            <span className="h-2 w-10 rounded-full bg-surface-200" />
            <span className="h-2 w-10 rounded-full bg-surface-200" />
            <span className="h-2 w-10 rounded-full bg-surface-200" />
          </span>
        </div>

        <div className="mt-4 rounded-control bg-linear-to-br from-brand-surface to-brand-surface-deep p-5">
          <span className="block h-3 w-2/3 rounded-full bg-white/90" />
          <span className="mt-2 block h-2 w-1/2 rounded-full bg-white/50" />
          <span className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-[10px] font-bold text-brand-700">
            Разгледай →
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-control border border-surface-200 p-2">
              <div className="flex aspect-square items-center justify-center rounded bg-linear-to-br from-surface-50 to-brand-50 text-surface-300">
                <Icon name="image" size={28} />
              </div>
              <span className="mt-2 block h-2 w-full rounded-full bg-surface-200" />
              <span className="mt-1.5 block h-2.5 w-1/2 rounded-full bg-brand-600/70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
