"use client";

import { Button, Checkbox, Drawer, Icon, Input, Select, Textarea } from "@/components/ui";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import { SECTION_DEFS } from "@/lib/sections";
import { TRUST_BADGE_ICONS, type Section } from "@/schemas/site-settings";

interface PickerOption {
  value: string;
  label: string;
}

interface SectionFormProps {
  section: Section | null;
  onClose: () => void;
  onSave: (section: Section) => void;
  onChange: (section: Section) => void;
  productOptions: PickerOption[];
  categoryOptions: PickerOption[];
}

const BADGE_LABELS: Record<(typeof TRUST_BADGE_ICONS)[number], string> = {
  truck: "Доставка",
  shield: "Сигурност",
  return: "Връщане",
  phone: "Поддръжка",
  leaf: "Натурално",
  star: "Качество",
};

function CheckboxPicker({
  options,
  selected,
  onChange,
  max,
}: {
  options: PickerOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  max: number;
}) {
  return (
    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-control border border-surface-200 p-2">
      {options.length === 0 && <p className="p-2 text-sm text-ink-500">Няма налични.</p>}
      {options.map((opt) => {
        const checked = selected.includes(opt.value);
        return (
          <Checkbox
            key={opt.value}
            label={opt.label}
            checked={checked}
            disabled={!checked && selected.length >= max}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, opt.value]
                  : selected.filter((id) => id !== opt.value),
              )
            }
          />
        );
      })}
    </div>
  );
}

/** Списъчен под-редактор (отзиви, FAQ, badges). */
function RowsEditor<T>({
  rows,
  onChange,
  makeEmpty,
  max,
  renderRow,
  addLabel,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  makeEmpty: () => T;
  max: number;
  renderRow: (row: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  addLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-2 rounded-control border border-surface-200 p-3">
          <div className="flex flex-1 flex-col gap-2">
            {renderRow(row, (patch) =>
              onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r))),
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Премахни"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
          >
            <Icon name="x" size={16} />
          </Button>
        </div>
      ))}
      {rows.length < max && (
        <div>
          <Button variant="secondary" size="sm" onClick={() => onChange([...rows, makeEmpty()])}>
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export function SectionForm({
  section,
  onClose,
  onSave,
  onChange,
  productOptions,
  categoryOptions,
}: SectionFormProps) {
  if (!section) return null;

  /* Типизиран ъпдейт на data полето на текущата секция */
  function patch(data: Record<string, unknown>) {
    if (!section) return;
    onChange({ ...section, data: { ...section.data, ...data } } as Section);
  }

  function fields() {
    switch (section!.type) {
      case "hero": {
        const d = section!.data;
        return (
          <>
            <Select
              label="Оформление"
              options={[
                { value: "split", label: "Текст вляво, снимка вдясно (с рамка)" },
                { value: "poster", label: "Текст върху голяма снимка (плакат)" },
                { value: "statement", label: "Плътен цветен блок (типографски)" },
              ]}
              value={d.layout}
              onChange={(e) => patch({ layout: e.target.value })}
            />
            <Input label="Заглавие" value={d.title} onChange={(e) => patch({ title: e.target.value })} />
            <Input label="Подзаглавие" value={d.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Текст на бутона" value={d.ctaLabel} onChange={(e) => patch({ ctaLabel: e.target.value })} hint="Празно = без бутон" />
              <Input label="Линк на бутона" value={d.ctaHref} onChange={(e) => patch({ ctaHref: e.target.value })} hint="Празно = към продуктите" />
            </div>
            <ImageUploader kind="site" images={d.imagePaths} max={5} onChange={(imagePaths) => patch({ imagePaths })} />
          </>
        );
      }
      case "announcement": {
        const d = section!.data;
        return (
          <>
            <Input label="Текст" value={d.text} onChange={(e) => patch({ text: e.target.value })} placeholder="Безплатна доставка над 30 €" />
            <Input label="Линк (по избор)" value={d.href} onChange={(e) => patch({ href: e.target.value })} />
          </>
        );
      }
      case "featured-products": {
        const d = section!.data;
        return (
          <>
            <Select
              label="Изглед"
              options={[
                { value: "1", label: "Мрежа с карти (следва броя продукти)" },
                { value: "2", label: "Списък до голяма снимка (editorial)" },
              ]}
              value={String(d.variant)}
              onChange={(e) => patch({ variant: Number(e.target.value) })}
            />
            <Input label="Заглавие" value={d.title} onChange={(e) => patch({ title: e.target.value })} />
            <Select
              label="Кои продукти"
              options={[
                { value: "newest", label: "Най-новите (автоматично)" },
                { value: "promo", label: "С промо цена (автоматично)" },
                { value: "manual", label: "Избирам ръчно" },
              ]}
              value={d.mode}
              onChange={(e) => patch({ mode: e.target.value })}
            />
            {d.mode === "manual" && (
              <CheckboxPicker
                options={productOptions}
                selected={d.productIds}
                max={8}
                onChange={(productIds) => patch({ productIds })}
              />
            )}
          </>
        );
      }
      case "category-grid": {
        const d = section!.data;
        return (
          <>
            <Select
              label="Изглед"
              options={[
                { value: "1", label: "Мозайка със снимки (пълна ширина)" },
                { value: "2", label: "Номериран списък (editorial)" },
              ]}
              value={String(d.variant)}
              onChange={(e) => patch({ variant: Number(e.target.value) })}
            />
            <Input label="Заглавие" value={d.title} onChange={(e) => patch({ title: e.target.value })} />
            <p className="text-sm text-ink-500">Избери категории (празно = основните автоматично):</p>
            <CheckboxPicker
              options={categoryOptions}
              selected={d.categoryIds}
              max={8}
              onChange={(categoryIds) => patch({ categoryIds })}
            />
          </>
        );
      }
      case "promo-banner": {
        const d = section!.data;
        return (
          <>
            <Input label="Заглавие" value={d.title} onChange={(e) => patch({ title: e.target.value })} />
            <Textarea label="Текст" rows={2} value={d.text} onChange={(e) => patch({ text: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Текст на бутона" value={d.ctaLabel} onChange={(e) => patch({ ctaLabel: e.target.value })} />
              <Input label="Линк на бутона" value={d.ctaHref} onChange={(e) => patch({ ctaHref: e.target.value })} />
            </div>
            <ImageUploader kind="site" images={d.imagePath ? [d.imagePath] : []} max={1} onChange={(paths) => patch({ imagePath: paths[0] ?? "" })} />
          </>
        );
      }
      case "image-text": {
        const d = section!.data;
        return (
          <>
            <Select
              label="Изглед"
              options={[
                { value: "1", label: "Снимка до текста (разделени)" },
                { value: "2", label: "Текст-карта върху снимката (застъпване)" },
              ]}
              value={String(d.variant)}
              onChange={(e) => patch({ variant: Number(e.target.value) })}
            />
            <Input label="Заглавие" value={d.title} onChange={(e) => patch({ title: e.target.value })} />
            <Textarea label="Текст" rows={5} value={d.text} onChange={(e) => patch({ text: e.target.value })} placeholder="Изберете нашето краве мляко, защото..." />
            <Select
              label="Снимката е"
              options={[
                { value: "left", label: "Вляво" },
                { value: "right", label: "Вдясно" },
              ]}
              value={d.imageSide}
              onChange={(e) => patch({ imageSide: e.target.value })}
            />
            <ImageUploader kind="site" images={d.imagePath ? [d.imagePath] : []} max={1} onChange={(paths) => patch({ imagePath: paths[0] ?? "" })} />
          </>
        );
      }
      case "rich-text": {
        const d = section!.data;
        return (
          <>
            <Select
              label="Изглед"
              options={[
                { value: "1", label: "Центриран (с голяма начална буква)" },
                { value: "2", label: "Заглавие вляво, текст вдясно" },
              ]}
              value={String(d.variant)}
              onChange={(e) => patch({ variant: Number(e.target.value) })}
            />
            <Input label="Заглавие" value={d.title} onChange={(e) => patch({ title: e.target.value })} />
            <Textarea label="Текст" rows={6} value={d.text} onChange={(e) => patch({ text: e.target.value })} hint="Празен ред = нов параграф." />
          </>
        );
      }
      case "testimonials": {
        const d = section!.data;
        return (
          <>
            <Select
              label="Изглед"
              options={[
                { value: "1", label: "Тъмна лента (контрастен акцент)" },
                { value: "2", label: "Светли карти с инициали" },
              ]}
              value={String(d.variant)}
              onChange={(e) => patch({ variant: Number(e.target.value) })}
            />
            <Input label="Заглавие" value={d.title} onChange={(e) => patch({ title: e.target.value })} />
            <RowsEditor
              rows={d.items}
              max={10}
              makeEmpty={() => ({ name: "", text: "" })}
              addLabel="+ Добави отзив"
              onChange={(items) => patch({ items })}
              renderRow={(row, update) => (
                <>
                  <Input label="Име на клиента" hideLabel placeholder="Име" value={row.name} onChange={(e) => update({ name: e.target.value })} />
                  <Textarea label="Отзив" rows={2} value={row.text} onChange={(e) => update({ text: e.target.value })} />
                </>
              )}
            />
          </>
        );
      }
      case "trust-badges": {
        const d = section!.data;
        return (
          <>
            <Select
              label="Изглед"
              options={[
                { value: "1", label: "Плочки с икони" },
                { value: "2", label: "Тиха лента (един ред)" },
              ]}
              value={String(d.variant)}
              onChange={(e) => patch({ variant: Number(e.target.value) })}
            />
            <RowsEditor
              rows={d.items}
              max={6}
              makeEmpty={() => ({ icon: "truck" as const, text: "" })}
              addLabel="+ Добави"
              onChange={(items) => patch({ items })}
              renderRow={(row, update) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    label="Икона"
                    hideLabel
                    options={TRUST_BADGE_ICONS.map((icon) => ({ value: icon, label: BADGE_LABELS[icon] }))}
                    value={row.icon}
                    onChange={(e) => update({ icon: e.target.value as typeof row.icon })}
                  />
                  <Input label="Текст" hideLabel placeholder="Доставка до 2 дни" value={row.text} onChange={(e) => update({ text: e.target.value })} />
                </div>
              )}
            />
          </>
        );
      }
      case "gallery": {
        const d = section!.data;
        return (
          <>
            <Select
              label="Изглед"
              options={[
                { value: "1", label: "Мозайка (адаптивна)" },
                { value: "2", label: "Филмова лента (плъзгане)" },
                { value: "3", label: "Движеща се стена (авто-плъзгане)" },
              ]}
              value={String(d.variant)}
              onChange={(e) => patch({ variant: Number(e.target.value) })}
            />
            <Input label="Заглавие" value={d.title} onChange={(e) => patch({ title: e.target.value })} />
            <ImageUploader kind="site" images={d.imagePaths} max={12} onChange={(imagePaths) => patch({ imagePaths })} />
          </>
        );
      }
      case "faq": {
        const d = section!.data;
        return (
          <>
            <Select
              label="Изглед"
              options={[
                { value: "1", label: "Центриран акордеон (карти)" },
                { value: "2", label: "Заглавие вляво, въпроси вдясно" },
              ]}
              value={String(d.variant)}
              onChange={(e) => patch({ variant: Number(e.target.value) })}
            />
            <Input label="Заглавие" value={d.title} onChange={(e) => patch({ title: e.target.value })} />
            <RowsEditor
              rows={d.items}
              max={15}
              makeEmpty={() => ({ question: "", answer: "" })}
              addLabel="+ Добави въпрос"
              onChange={(items) => patch({ items })}
              renderRow={(row, update) => (
                <>
                  <Input label="Въпрос" hideLabel placeholder="Въпрос" value={row.question} onChange={(e) => update({ question: e.target.value })} />
                  <Textarea label="Отговор" rows={2} value={row.answer} onChange={(e) => update({ answer: e.target.value })} />
                </>
              )}
            />
          </>
        );
      }
      case "contact-map": {
        const d = section!.data;
        return (
          <>
            <Select
              label="Изглед"
              options={[
                { value: "1", label: "Редове до картата" },
                { value: "2", label: "Панел върху картата" },
                { value: "3", label: "Визитка (едри телефон/имейл)" },
              ]}
              value={String(d.variant)}
              onChange={(e) => patch({ variant: Number(e.target.value) })}
            />
            <Input label="Заглавие" value={d.title} onChange={(e) => patch({ title: e.target.value })} />
            <Checkbox label="Показвай карта" checked={d.showMap} onChange={(e) => patch({ showMap: e.target.checked })} />
            <p className="text-sm text-ink-500">Контактите идват от таб „Магазин“.</p>
          </>
        );
      }
      case "socials": {
        const d = section!.data;
        return (
          <>
            <Select
              label="Изглед"
              options={[
                { value: "1", label: "Центрирани бутони" },
                { value: "2", label: "Цветна лента (акцент)" },
                { value: "3", label: "Списък с редове" },
              ]}
              value={String(d.variant)}
              onChange={(e) => patch({ variant: Number(e.target.value) })}
            />
            <Input label="Заглавие" value={d.title} onChange={(e) => patch({ title: e.target.value })} />
            <p className="text-sm text-ink-500">Линковете идват от таб „Магазин“.</p>
          </>
        );
      }
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={SECTION_DEFS[section.type].label}
      footer={<Button onClick={() => onSave(section)}>Готово</Button>}
    >
      <div className="flex flex-col gap-4">{fields()}</div>
    </Drawer>
  );
}
