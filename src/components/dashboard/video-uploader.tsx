"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { requestImageUpload } from "@/actions/uploads";
import { Button, Icon, Spinner } from "@/components/ui";
import {
  ALLOWED_VIDEO_EXT,
  fileExtension,
  MAX_VIDEO_BYTES,
  publicImageUrl,
  SHOP_MEDIA_BUCKET,
} from "@/lib/storage";
import { uploadToSignedUrlWithProgress } from "@/lib/upload-to-signed-url";
import { createSupabaseBrowser } from "@/lib/supabase/client";

interface VideoUploaderProps {
  /** Текущият видео път (или ""). */
  value: string;
  onChange: (path: string) => void;
}

/**
 * Качване на едно hero видео (MP4/WebM, ≤15MB). Реален прогрес през XHR
 * (същият механизъм като снимките); fallback към SDK-то. Показва малък
 * видео преглед + бутон за премахване.
 */
export function VideoUploader({ value, onChange }: VideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [percent, setPercent] = useState<number | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    const ext = fileExtension(file.name);
    if (!(ALLOWED_VIDEO_EXT as readonly string[]).includes(ext)) {
      toast.error(`„${file.name}": поддържани са само MP4 и WebM.`);
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(`„${file.name}": видеото е над 15MB.`);
      return;
    }

    const request = await requestImageUpload({ ext, kind: "video" });
    if (!request.ok) {
      toast.error(request.error);
      return;
    }

    setPercent(0);
    try {
      await uploadToSignedUrlWithProgress({
        path: request.data.path,
        token: request.data.token,
        file,
        onProgress: setPercent,
      });
      onChange(request.data.path);
    } catch {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.storage
        .from(SHOP_MEDIA_BUCKET)
        .uploadToSignedUrl(request.data.path, request.data.token, file);
      if (error) {
        toast.error(`„${file.name}": качването се провали.`);
      } else {
        onChange(request.data.path);
      }
    } finally {
      setPercent(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (percent !== null) {
    return (
      <div className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-control border border-surface-200 bg-surface-50">
        <Spinner size="sm" />
        <span className="text-sm font-medium text-ink-600">{percent}%</span>
      </div>
    );
  }

  if (value) {
    return (
      <div className="flex flex-col gap-2">
        <div className="relative w-full max-w-xs overflow-hidden rounded-control border border-surface-200 bg-ink-900">
          <video
            src={publicImageUrl(value)}
            className="h-40 w-full object-cover"
            muted
            loop
            playsInline
            autoPlay
            /* preload=metadata: показва първи кадър дори ако браузърът не
               autoplay-не в редактора (иначе плочката е празна). */
            preload="metadata"
          />
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink-900/70 px-2 py-0.5 text-[10px] font-medium text-white">
            Видео качено ✓
          </span>
        </div>
        {/* Отделен видим бутон (не icon-only overlay) — сигурно се натиска. */}
        <div>
          <Button variant="secondary" size="sm" onClick={() => onChange("")}>
            <Icon name="x" size={14} className="-ml-0.5" />
            Премахни видеото
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-control border-2 border-dashed border-surface-300 text-ink-500 transition-colors hover:border-brand-500 hover:text-brand-600"
      >
        <Icon name="plus" size={20} />
        <span className="text-xs">Качи видео (MP4/WebM, до 15MB)</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </>
  );
}
