"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  publishShop,
  saveSiteSettings,
  savePreviewDraft,
  setShopLogo,
  unpublishShop,
} from "@/actions/site-settings";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import { Badge, Button, Card, Drawer, Icon, Input, Textarea } from "@/components/ui";
import { newSection, SECTION_DEFS } from "@/lib/sections";
import type { SectionType, SiteSettings } from "@/schemas/site-settings";
import { SectionForm } from "./section-form";
import { SectionsList } from "./sections-list";
import { ThemePanel } from "./theme-panel";
import { WebsiteIntroModal } from "./website-intro-modal";
import { WebsitePreview, type WebsitePreviewHandle } from "./preview";

type PanelTab = "theme" | "sections" | "about" | "preview";

interface PickerOption {
  value: string;
  label: string;
}

interface WebsiteEditorProps {
  shop: { id: string; name: string; slug: string; status: string; logoPath: string | null };
  initial: SiteSettings;
  productOptions: PickerOption[];
  categoryOptions: PickerOption[];
}

export function WebsiteEditor({ shop, initial, productOptions, categoryOptions }: WebsiteEditorProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<SiteSettings>(initial);
  const [dirty, setDirty] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [tab, setTab] = useState<PanelTab>("sections");
  const previewRef = useRef<WebsitePreviewHandle>(null);
  const isPublished = shop.status === "published";

  function update(next: SiteSettings) {
    setSettings(next);
    setDirty(true);
  }

  /* Live preview: debounce → draft запис → сигнал към iframe-а */
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(async () => {
      const result = await savePreviewDraft(settings);
      if (result.ok) previewRef.current?.refresh();
    }, 500);
    return () => clearTimeout(timer);
  }, [settings, dirty]);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveSiteSettings(settings);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDirty(false);
      toast.success("Промените са публикувани по сайта.");
      previewRef.current?.refresh();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishToggle() {
    setPublishing(true);
    try {
      const result = isPublished ? await unpublishShop() : await publishShop();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isPublished ? "Магазинът е скрит." : "Магазинът е публикуван! 🎉");
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  async function handleLogoChange(paths: string[]) {
    const result = await setShopLogo({ path: paths[0] ?? null });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Логото е обновено.");
      previewRef.current?.refresh();
      router.refresh();
    }
  }

  const editingSection = settings.sections.find((s) => s.id === editingId) ?? null;
  const publicUrl = `/s/${shop.slug}`;

  function addSection(type: SectionType) {
    const section = newSection(type);
    update({ ...settings, sections: [...settings.sections, section] });
    setPickerOpen(false);
    setEditingId(section.id);
  }

  const TABS: { key: PanelTab; label: string; mobileOnly?: boolean }[] = [
    { key: "theme", label: "Тема" },
    { key: "sections", label: "Секции" },
    { key: "about", label: "За нас" },
    { key: "preview", label: "Преглед", mobileOnly: true },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Топ-бар */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-surface-200 bg-surface-0 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm font-medium text-ink-700 transition-colors hover:text-ink-900"
          >
            <Icon name="chevron-down" size={18} className="rotate-90" />
            <span className="hidden sm:inline">Табло</span>
          </Link>
          <div className="h-5 w-px bg-surface-200" />
          <h1 className="truncate text-sm font-bold text-ink-900">{shop.name}</h1>
          <Badge tone={isPublished ? "success" : "neutral"}>
            {isPublished ? "Публикуван" : "Чернова"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm text-brand-600 hover:underline sm:inline"
          >
            Отвори сайта ↗
          </a>
          <Button variant="secondary" size="sm" onClick={handlePublishToggle} loading={publishing}>
            {isPublished ? "Скрий" : "Публикувай"}
          </Button>
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!dirty}>
            Запази
          </Button>
        </div>
      </header>

      {/* Тяло */}
      <div className="flex min-h-0 flex-1">
        {/* Панел */}
        <aside
          className={`w-full flex-col border-r border-surface-200 bg-surface-50 lg:flex lg:w-95 lg:shrink-0 ${
            tab === "preview" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Табове */}
          <div className="flex shrink-0 gap-1 border-b border-surface-200 p-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={tab === t.key}
                className={`h-9 flex-1 rounded-control text-sm font-medium transition-colors ${
                  t.mobileOnly ? "lg:hidden" : ""
                } ${
                  tab === t.key
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-600 hover:bg-surface-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Съдържание на активния таб */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "theme" && (
              <div className="flex flex-col gap-4">
                <Card className="flex flex-col gap-3">
                  <h2 className="font-bold text-ink-900">Тема и цветове</h2>
                  <ThemePanel
                    settings={settings}
                    onChange={(patch) => update({ ...settings, ...patch })}
                  />
                  <Input
                    label="Текст във footer-а"
                    value={settings.footerText}
                    onChange={(e) => update({ ...settings, footerText: e.target.value })}
                    placeholder="Кратко мото или описание"
                  />
                </Card>

                <Card className="flex flex-col gap-3">
                  <h2 className="font-bold text-ink-900">Лого</h2>
                  <ImageUploader
                    kind="branding"
                    images={shop.logoPath ? [shop.logoPath] : []}
                    max={1}
                    onChange={handleLogoChange}
                  />
                </Card>
              </div>
            )}

            {tab === "sections" && (
              <Card className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-ink-900">Секции на началната страница</h2>
                  <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
                    + Добави
                  </Button>
                </div>
                <SectionsList
                  sections={settings.sections}
                  onChange={(sections) => update({ ...settings, sections })}
                  onEdit={(section) => setEditingId(section.id)}
                  onRemove={(id) =>
                    update({
                      ...settings,
                      sections: settings.sections.filter((s) => s.id !== id),
                    })
                  }
                />
              </Card>
            )}

            {tab === "about" && (
              <Card className="flex flex-col gap-3">
                <h2 className="font-bold text-ink-900">Страница „За нас“</h2>
                <p className="text-sm text-ink-500">
                  Показва се на страница „За нас“ — превключи preview-то на нея, за да я
                  видиш.
                </p>
                <Textarea
                  label="Представяне на бизнеса"
                  rows={5}
                  value={settings.aboutText}
                  onChange={(e) => update({ ...settings, aboutText: e.target.value })}
                  hint="Празен ред = нов параграф."
                />
                <ImageUploader
                  kind="site"
                  images={settings.aboutImagePaths}
                  max={4}
                  onChange={(aboutImagePaths) => update({ ...settings, aboutImagePaths })}
                />
              </Card>
            )}
          </div>
        </aside>

        {/* Preview зона */}
        <div
          className={`min-w-0 flex-1 ${tab === "preview" ? "flex" : "hidden lg:flex"}`}
        >
          <WebsitePreview ref={previewRef} slug={shop.slug} />
        </div>
      </div>

      <WebsiteIntroModal />

      <SectionForm
        section={editingSection}
        onClose={() => setEditingId(null)}
        onSave={() => setEditingId(null)}
        onChange={(section) =>
          update({
            ...settings,
            sections: settings.sections.map((s) => (s.id === section.id ? section : s)),
          })
        }
        productOptions={productOptions}
        categoryOptions={categoryOptions}
      />

      <Drawer open={pickerOpen} onClose={() => setPickerOpen(false)} title="Добави секция">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(SECTION_DEFS) as SectionType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => addSection(type)}
              className="flex items-center gap-2 rounded-control border border-surface-200 p-3 text-left text-sm font-medium text-ink-900 transition-colors hover:border-brand-500 hover:bg-brand-50"
            >
              <Icon name={SECTION_DEFS[type].icon} size={18} className="shrink-0 text-ink-500" />
              {SECTION_DEFS[type].label}
            </button>
          ))}
        </div>
      </Drawer>
    </div>
  );
}
