import { SHOP_MEDIA_BUCKET } from "@/lib/storage";

/**
 * Качва файл към Supabase signed upload URL през XMLHttpRequest, за да имаме
 * реален прогрес (fetch/SDK-то не дават `upload.onprogress`). Възпроизвежда
 * точно контракта на `uploadToSignedUrl`: POST към
 * `/storage/v1/object/upload/sign/{bucket}/{path}?token=...`, `multipart/form-data`
 * с поле `cacheControl` + празно-именуваното поле за файла. При отказ хвърля —
 * извикващият пада обратно към SDK-то.
 */
export function uploadToSignedUrlWithProgress({
  path,
  token,
  file,
  onProgress,
  signal,
}: {
  path: string;
  token: string;
  file: File;
  /** 0–100, извиква се при всеки progress event. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const url = `${base}/storage/v1/object/upload/sign/${SHOP_MEDIA_BUCKET}/${path}?token=${encodeURIComponent(
      token,
    )}`;

    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });
}
