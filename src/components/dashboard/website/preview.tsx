"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui";

export interface WebsitePreviewHandle {
  refresh: () => void;
}

/** Live preview на магазина: iframe + сигнал за refresh през postMessage. */
export const WebsitePreview = forwardRef<WebsitePreviewHandle, { slug: string }>(
  function WebsitePreview({ slug }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

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
        <div className="flex items-center justify-end gap-1">
          <Button
            variant={device === "desktop" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={device === "desktop"}
            onClick={() => setDevice("desktop")}
          >
            🖥 Десктоп
          </Button>
          <Button
            variant={device === "mobile" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={device === "mobile"}
            onClick={() => setDevice("mobile")}
          >
            📱 Телефон
          </Button>
        </div>
        <div className="flex justify-center overflow-hidden rounded-card border border-surface-200 bg-surface-100 p-3">
          <iframe
            ref={iframeRef}
            src={`/s/${slug}`}
            title="Преглед на магазина"
            className={`h-[70vh] rounded-control border border-surface-300 bg-surface-0 transition-all ${
              device === "mobile" ? "w-[390px]" : "w-full"
            }`}
          />
        </div>
      </div>
    );
  },
);
