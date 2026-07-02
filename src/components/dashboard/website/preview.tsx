"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui";

export interface WebsitePreviewHandle {
  refresh: () => void;
}

const PAGES = [
  { path: "", label: "Начало" },
  { path: "/products", label: "Продукти" },
  { path: "/about", label: "За нас" },
  { path: "/contact", label: "Контакти" },
] as const;

/** Live preview на магазина: iframe + табове за страниците + refresh сигнал. */
export const WebsitePreview = forwardRef<WebsitePreviewHandle, { slug: string }>(
  function WebsitePreview({ slug }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
    const [pagePath, setPagePath] = useState<string>("");

    useImperativeHandle(ref, () => ({
      refresh() {
        iframeRef.current?.contentWindow?.postMessage(
          "frizmo-preview-refresh",
          window.location.origin,
        );
      },
    }));

    return (
      <div className="hidden flex-col gap-2 lg:flex">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {PAGES.map((page) => (
              <Button
                key={page.path}
                variant={pagePath === page.path ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={pagePath === page.path}
                onClick={() => setPagePath(page.path)}
              >
                {page.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-1">
            <Button
              variant={device === "desktop" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={device === "desktop"}
              onClick={() => setDevice("desktop")}
            >
              🖥
            </Button>
            <Button
              variant={device === "mobile" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={device === "mobile"}
              onClick={() => setDevice("mobile")}
            >
              📱
            </Button>
          </div>
        </div>
        <div className="flex justify-center overflow-hidden rounded-card border border-surface-200 bg-surface-100 p-3">
          <iframe
            ref={iframeRef}
            src={`/s/${slug}${pagePath}`}
            title="Преглед на магазина"
            className={`h-[70vh] rounded-control border border-surface-300 bg-surface-0 transition-all ${
              device === "mobile" ? "w-97.5" : "w-full"
            }`}
          />
        </div>
      </div>
    );
  },
);
