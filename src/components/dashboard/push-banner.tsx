"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { savePushSubscription } from "@/actions/push";
import { Button, Card } from "@/components/ui";

type PushState = "unsupported" | "ios-needs-install" | "prompt" | "granted" | "denied";

function detectState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  if (isIos && !standalone) return "ios-needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "prompt";
}

function base64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const DISMISS_KEY = "frizmo-push-dismissed";

export function PushBanner() {
  const [state, setState] = useState<PushState | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    /* Микротаск: избягва синхронен setState в тялото на ефекта (react-compiler). */
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || window.localStorage.getItem(DISMISS_KEY)) return;
      const detected = detectState();
      if (detected === "prompt" || detected === "ios-needs-install") setState(detected);
      /* granted → регистрираме тихо sw-то, за да е активен и след рестарт */
      if (detected === "granted") void navigator.serviceWorker.register("/sw.js");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  async function subscribe() {
    setSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Известията са отказани от браузъра.");
        setState(null);
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
        ) as unknown as BufferSource,
      });
      const result = await savePushSubscription(subscription.toJSON());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Готово! Ще получаваш известие при всяка нова поръчка.");
      setState(null);
    } catch {
      toast.error("Известията не можаха да се активират.");
    } finally {
      setSubscribing(false);
    }
  }

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setState(null);
  }

  return (
    <Card className="mb-4 flex flex-col gap-3 border-brand-500 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-ink-900">🔔 Известия за нови поръчки</p>
        <p className="text-sm text-ink-700">
          {state === "ios-needs-install"
            ? "На iPhone: добави приложението на началния екран (Сподели → Добави към Начален екран), после активирай известията оттук."
            : "Получавай известие на това устройство при всяка нова поръчка."}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {state === "prompt" && (
          <Button size="sm" onClick={subscribe} loading={subscribing}>
            Активирай
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={dismiss}>
          По-късно
        </Button>
      </div>
    </Card>
  );
}
