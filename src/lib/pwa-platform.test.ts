import { describe, expect, it } from "vitest";
import { detectPlatform, getInstallInstructions } from "./pwa-platform";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.0.0 Mobile/15E148 Safari/604.1",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  androidFirefox:
    "Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  desktopEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
};

describe("detectPlatform", () => {
  it("iOS Safari", () => {
    const p = detectPlatform(UA.iosSafari, false);
    expect(p.os).toBe("ios");
    expect(p.browser).toBe("safari");
  });
  it("iOS Chrome (CriOS) → ios/chrome", () => {
    const p = detectPlatform(UA.iosChrome, false);
    expect(p.os).toBe("ios");
    expect(p.browser).toBe("chrome");
  });
  it("Android Chrome", () => {
    const p = detectPlatform(UA.androidChrome, false);
    expect(p.os).toBe("android");
    expect(p.browser).toBe("chrome");
  });
  it("Android Samsung Internet", () => {
    expect(detectPlatform(UA.androidSamsung, false).browser).toBe("samsung");
  });
  it("Android Firefox", () => {
    expect(detectPlatform(UA.androidFirefox, false).browser).toBe("firefox");
  });
  it("Desktop Chrome", () => {
    const p = detectPlatform(UA.desktopChrome, false);
    expect(p.os).toBe("desktop");
    expect(p.browser).toBe("chrome");
  });
  it("Desktop Edge", () => {
    expect(detectPlatform(UA.desktopEdge, false).browser).toBe("edge");
  });
  it("standalone флагът се пренася", () => {
    expect(detectPlatform(UA.iosSafari, true).isStandalone).toBe(true);
  });
});

describe("getInstallInstructions", () => {
  it("iOS Safari → manual, 3 стъпки", () => {
    const g = getInstallInstructions("ios", "safari");
    expect(g.canInstall).toBe("manual");
    expect(g.steps.length).toBe(3);
    expect(g.deviceLabel).toContain("iPhone");
  });
  it("iOS Chrome → wrong-browser с note", () => {
    const g = getInstallInstructions("ios", "chrome");
    expect(g.canInstall).toBe("wrong-browser");
    expect(g.note).toBeTruthy();
  });
  it("Android Chrome → manual стъпки", () => {
    const g = getInstallInstructions("android", "chrome");
    expect(g.canInstall).toBe("manual");
    expect(g.steps.length).toBeGreaterThan(0);
  });
  it("Android Samsung → manual", () => {
    expect(getInstallInstructions("android", "samsung").canInstall).toBe("manual");
  });
  it("Desktop Chrome → manual", () => {
    expect(getInstallInstructions("desktop", "chrome").canInstall).toBe("manual");
  });
});
