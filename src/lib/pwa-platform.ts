import type { IconName } from "@/components/ui";

export type OS = "ios" | "android" | "desktop";
export type Browser = "safari" | "chrome" | "samsung" | "firefox" | "edge" | "other";
export type Platform = { os: OS; browser: Browser; isStandalone: boolean };

/**
 * Разпознава платформа + браузър от userAgent. Аргументите позволяват тестване;
 * по подразбиране чете от navigator (клиент). Не разчита на версии — те са
 * ненадеждни и не менят install стъпките.
 */
export function detectPlatform(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
  standalone?: boolean,
): Platform {
  const ua = userAgent.toLowerCase();
  const isStandalone =
    standalone ??
    (typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true));

  let os: OS = "desktop";
  if (/iphone|ipad|ipod/.test(ua)) os = "ios";
  else if (/android/.test(ua)) os = "android";

  let browser: Browser = "other";
  if (os === "ios") {
    /* iOS: не-Safari браузърите се разпознават по crios/fxios/edgios. */
    if (/crios/.test(ua)) browser = "chrome";
    else if (/fxios/.test(ua)) browser = "firefox";
    else if (/edgios/.test(ua)) browser = "edge";
    else browser = "safari";
  } else if (os === "android") {
    if (/samsungbrowser/.test(ua)) browser = "samsung";
    else if (/firefox/.test(ua)) browser = "firefox";
    else browser = "chrome";
  } else {
    if (/edg\//.test(ua)) browser = "edge";
    else if (/firefox/.test(ua)) browser = "firefox";
    else if (/chrome/.test(ua)) browser = "chrome";
    else if (/safari/.test(ua)) browser = "safari";
  }

  return { os, browser, isStandalone: Boolean(isStandalone) };
}

export type InstallStep = { text: string; icon?: IconName };
export type CanInstall = "manual" | "wrong-browser";
export type InstallGuide = {
  deviceLabel: string;
  canInstall: CanInstall;
  steps: InstallStep[];
  note?: string;
};

/**
 * Точните install стъпки за дадена платформа+браузър. Чиста функция —
 * ползва се и от секцията, и от modal-а (ръчен превключвател подава os/browser).
 */
export function getInstallInstructions(os: OS, browser: Browser): InstallGuide {
  if (os === "ios") {
    if (browser !== "safari") {
      return {
        deviceLabel: "iPhone",
        canInstall: "wrong-browser",
        steps: [],
        note: "За да инсталираш на iPhone, отвори този сайт в Safari — другите браузъри на iPhone не позволяват добавяне към началния екран.",
      };
    }
    return {
      deviceLabel: "iPhone · Safari",
      canInstall: "manual",
      steps: [
        { text: "Тапни бутона „Сподели“ в лентата долу.", icon: "share" },
        { text: "Превърти и избери „Към началния екран“.", icon: "plus" },
        { text: "Тапни „Добави“ горе вдясно.", icon: "check" },
      ],
    };
  }

  if (os === "android") {
    if (browser === "samsung") {
      return {
        deviceLabel: "Android · Samsung Internet",
        canInstall: "manual",
        steps: [
          { text: "Отвори менюто (трите чертички долу).", icon: "menu" },
          { text: "Избери „Добави страницата към“ → „Начален екран“.", icon: "plus" },
          { text: "Потвърди с „Добави“.", icon: "check" },
        ],
      };
    }
    if (browser === "firefox") {
      return {
        deviceLabel: "Android · Firefox",
        canInstall: "manual",
        steps: [
          { text: "Отвори менюто (трите точки).", icon: "menu" },
          { text: "Избери „Инсталирай“.", icon: "plus" },
          { text: "Потвърди инсталирането.", icon: "check" },
        ],
      };
    }
    return {
      deviceLabel: "Android · Chrome",
      canInstall: "manual",
      steps: [
        { text: "Отвори менюто (трите точки горе вдясно).", icon: "menu" },
        { text: "Избери „Инсталирай приложението“.", icon: "plus" },
        { text: "Потвърди с „Инсталирай“.", icon: "check" },
      ],
    };
  }

  return {
    deviceLabel: "Компютър",
    canInstall: "manual",
    steps: [
      { text: "Погледни вдясно в адресната лента за иконата за инсталиране (⊕).", icon: "plus" },
      { text: "Кликни я и избери „Инсталирай“.", icon: "check" },
    ],
    note: "Ако не виждаш иконата, отвори менюто на браузъра → „Инсталирай Frizmo Shops“.",
  };
}
