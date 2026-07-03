import { Icon, type IconName } from "@/components/ui";
import {
  OrderNotificationMockup,
  ThemeEditorMockup,
  VisibilityMockup,
} from "./feature-mockups";

/** Заглавие + текст на клетка — споделен блок. */
function CellHeader({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">{title}</h3>
      <p className="text-[15px] leading-relaxed text-ink-700">{text}</p>
    </div>
  );
}

const cellBase =
  "group relative flex flex-col justify-between gap-6 overflow-hidden rounded-card border border-surface-200 bg-surface-0 p-6 shadow-card transition-all hover:border-surface-300 hover:shadow-float sm:p-8";

/**
 * Bento grid за „Функции" — разноголеми карти, всяка запълнена с мокъп.
 * Голямата флагман карта (персонализация) заема цялата ширина отгоре;
 * поръчки и видимост споделят реда отдолу.
 */
export function FeatureBento() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Флагман — персонализация, широка карта с мокъп вдясно */}
      <div className={`${cellBase} lg:col-span-2 lg:flex-row lg:items-center lg:gap-10`}>
        <div className="lg:max-w-sm">
          <CellHeader
            icon="palette"
            title="Магазин, който изглежда като теб"
            text="Теми, твоите цветове, твоето лого, подреждаеми секции — „за нас“, отзиви, галерия, промо банери. Личи си, че е твое, без ред код."
          />
        </div>
        <div className="flex flex-1 justify-center lg:justify-end">
          <ThemeEditorMockup />
        </div>
      </div>

      {/* Поръчки */}
      <div className={cellBase}>
        <CellHeader
          icon="bell"
          title="Поръчките идват при теб"
          text="Нова поръчка? Известие на телефона и имейл за секунди. Потвърждаваш, изпращаш, завършваш — наличностите се следят сами."
        />
        <div className="flex justify-center">
          <OrderNotificationMockup />
        </div>
      </div>

      {/* Видимост */}
      <div className={cellBase}>
        <CellHeader
          icon="trending-up"
          title="Видимост от първия ден"
          text="Магазинът ти е в каталога на Frizmo Shops и се индексира от Google. Клиентите те намират — не обратното."
        />
        <div className="flex justify-center">
          <VisibilityMockup />
        </div>
      </div>
    </div>
  );
}
