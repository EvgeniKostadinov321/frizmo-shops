"use client";

import { useEffect, useRef, useState } from "react";

/* Ключ, който бележи, че потребителят вече е взаимодействал с приложението поне
   веднъж — тогава браузърът разрешава autoplay със звук. Първото отваряне е тихо
   (autoplay policy), следващите студени стартове пускат мелодийката. */
const INTERACTED_KEY = "frizmo-audio-ok";
/* Максимална продължителност на splash-а, ако видеото не сигнализира край. */
const MAX_MS = 3600;

type Phase = "showing" | "leaving" | "done";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  /* iOS Safari ползва navigator.standalone; останалите — display-mode media query. */
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  const displayStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  return iosStandalone || displayStandalone;
}

/**
 * PWA splash / welcome анимация. Показва се при студен старт на инсталираното
 * приложение (standalone) — маскот-видеото в уютна работилница + изписване на
 * „Frizmo Shops". Тап затваря веднага; иначе затихва след видеото/таймер.
 *
 * НЕ се показва в обикновен браузър таб (само в PWA). Сървърът рендерира null,
 * решението е чисто клиентско (избягва hydration mismatch и FOUC на публичните
 * страници). Само токени → работи и в light, и в dark зоните.
 */
export function PwaSplash() {
  /* mounted гейтва рендера — при първия клиентски render е false, съвпада със
     сървъра (null). След ефекта решаваме дали изобщо да покажем splash-а. */
  const [phase, setPhase] = useState<Phase | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isStandalone()) return;
    /* setState синхронно в effect чупи react-compiler lint → queueMicrotask
       (проектно гочи, виж CLAUDE-frontend.md). */
    queueMicrotask(() => setPhase("showing"));

    /* Опит за пускане на музиката. При първо отваряне браузърът блокира звука —
       ловим тихо; при следващи стартове (вече има взаимодействие) свири. */
    const audio = audioRef.current;
    if (audio && localStorage.getItem(INTERACTED_KEY) === "1") {
      audio.volume = 0.5;
      audio.play().catch(() => {
        /* Блокирано от autoplay policy — splash минава тихо, без грешка. */
      });
    }
    /* Бележим взаимодействие при първи pointer/keydown, за да позволим звук
       на следващия студен старт. */
    const markInteracted = () => localStorage.setItem(INTERACTED_KEY, "1");
    window.addEventListener("pointerdown", markInteracted, { once: true });
    window.addEventListener("keydown", markInteracted, { once: true });

    /* Предпазен таймер — ако видеото не зареди/не сигнализира край. */
    timerRef.current = setTimeout(() => leave(), MAX_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("pointerdown", markInteracted);
      window.removeEventListener("keydown", markInteracted);
    };
  }, []);

  function leave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    /* Плавно заглушаване на музиката успоредно с fade-out на картината. */
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      const fade = setInterval(() => {
        audio.volume = Math.max(0, audio.volume - 0.1);
        if (audio.volume <= 0.01) {
          audio.pause();
          clearInterval(fade);
        }
      }, 40);
    }
    setPhase("leaving");
  }

  if (phase === null || phase === "done") return null;

  return (
    <div
      role="presentation"
      onClick={leave}
      onAnimationEnd={(e) => {
        /* Край на fade-out анимацията → демонтираме overlay-я. */
        if (e.animationName.startsWith("splash-out")) setPhase("done");
      }}
      className={`fixed inset-0 z-100 flex flex-col items-center justify-center gap-6 bg-surface-50 ${
        phase === "leaving" ? "animate-splash-out" : "animate-fade-in"
      }`}
    >
      {/* Видеото на маскота в кръгъл кадър — poster показва статичния кадър
          при reduced-motion / докато зареди. muted → autoplay винаги минава. */}
      <div className="relative aspect-9/16 w-full max-w-sm overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover motion-reduce:hidden"
          muted
          playsInline
          autoPlay
          preload="auto"
          poster="/splash-bee-poster.jpg"
          onEnded={leave}
          onError={leave}
          aria-hidden
        >
          <source src="/splash-bee.mp4" type="video/mp4" />
        </video>
        {/* Reduced-motion fallback: статичен постер вместо видеото. next/image
            е неуместен тук — статичен splash asset, не минава оптимизация. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/splash-bee-poster.jpg"
          alt=""
          className="hidden h-full w-full object-cover motion-reduce:block"
          aria-hidden
        />
        {/* Wordmark върху горното празно пространство на кадъра. */}
        <div className="absolute inset-x-0 top-[14%] flex justify-center">
          <p className="animate-splash-word font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Frizmo Shops
          </p>
        </div>
      </div>

      <audio ref={audioRef} preload="auto" aria-hidden>
        <source src="/splash-welcome.mp3" type="audio/mpeg" />
      </audio>
    </div>
  );
}
