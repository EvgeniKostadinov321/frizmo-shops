"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { requestImageUpload } from "@/actions/uploads";
import { Icon, Spinner } from "@/components/ui";
import {
  ALLOWED_IMAGE_EXT,
  fileExtension,
  MAX_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
  publicImageUrl,
  SHOP_MEDIA_BUCKET,
} from "@/lib/storage";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  /** Папка в Storage: product (default), branding (лого), site (секции). */
  kind?: "product" | "branding" | "site";
}

export function ImageUploader({
  images,
  onChange,
  max = MAX_PRODUCT_IMAGES,
  kind = "product",
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  async function uploadOne(file: File): Promise<string | null> {
    const ext = fileExtension(file.name);
    if (!(ALLOWED_IMAGE_EXT as readonly string[]).includes(ext)) {
      toast.error(`„${file.name}": неподдържан формат (JPG, PNG, WebP, AVIF).`);
      return null;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`„${file.name}": файлът е над 5MB.`);
      return null;
    }

    const request = await requestImageUpload({ ext, kind });
    if (!request.ok) {
      toast.error(request.error);
      return null;
    }

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.storage
      .from(SHOP_MEDIA_BUCKET)
      .uploadToSignedUrl(request.data.path, request.data.token, file);
    if (error) {
      toast.error(`„${file.name}": качването се провали.`);
      return null;
    }
    return request.data.path;
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).slice(0, max - images.length);
    if (files.length < fileList.length) {
      toast.error(`Максимум ${max} снимки на продукт.`);
    }
    if (files.length === 0) return;

    setUploading(files.length);
    const uploaded: string[] = [];
    for (const file of files) {
      const path = await uploadOne(file);
      if (path) uploaded.push(path);
      setUploading((n) => n - 1);
    }
    if (uploaded.length > 0) onChange([...images, ...uploaded]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const item = next[index]!;
    next[index] = next[target]!;
    next[target] = item;
    onChange(next);
  }

  return (
    <div className="flex flex-wrap gap-3">
      {images.map((path, i) => (
        <div
          key={path}
          className="group relative size-24 overflow-hidden rounded-control border border-surface-200 bg-surface-50"
        >
          <Image
            src={publicImageUrl(path)}
            alt={i === 0 ? "Корица" : `Снимка ${i + 1}`}
            fill
            sizes="96px"
            className="object-cover"
          />
          {i === 0 && (
            <span className="absolute left-1 top-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
              Корица
            </span>
          )}
          {/* Триене (горе вдясно) — винаги видимо на тъч, hover на десктоп. */}
          <button
            type="button"
            aria-label="Премахни снимката"
            onClick={() => onChange(images.filter((p) => p !== path))}
            className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink-900/70 text-white transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Icon name="x" size={14} />
          </button>
          {/* Пренареждане (долу) — стрелки наляво/надясно. */}
          <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink-900/60 px-1 py-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <button
              type="button"
              aria-label="Премести наляво"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="flex size-6 items-center justify-center text-white disabled:opacity-40"
            >
              <Icon name="arrow-up" size={16} className="-rotate-90" />
            </button>
            <button
              type="button"
              aria-label="Премести надясно"
              onClick={() => move(i, 1)}
              disabled={i === images.length - 1}
              className="flex size-6 items-center justify-center text-white disabled:opacity-40"
            >
              <Icon name="arrow-down" size={16} className="-rotate-90" />
            </button>
          </div>
        </div>
      ))}

      {Array.from({ length: uploading }).map((_, i) => (
        <div
          key={`uploading-${i}`}
          className="flex size-24 items-center justify-center rounded-control border border-surface-200 bg-surface-50"
        >
          <Spinner size="sm" />
        </div>
      ))}

      {images.length + uploading < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex size-24 flex-col items-center justify-center gap-1 rounded-control border-2 border-dashed border-surface-300 text-ink-500 transition-colors hover:border-brand-500 hover:text-brand-600"
        >
          <Icon name="plus" size={20} />
          <span className="text-xs">Добави</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
