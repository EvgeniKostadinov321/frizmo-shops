/*
 * Генерира PWA/favicon иконите от бранд логото (public/logo-mark.png).
 * Пуска се ръчно при смяна на логото: node scripts/generate-icons.mjs
 * OG изображението се генерира отделно от src/app/(marketing)/opengraph-image.tsx.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
/* Логото като data-URI, за да го рендерираме офлайн в headless Chromium */
const logoPng = readFileSync(resolve(root, "public/logo-mark.png"));
const logoUri = `data:image/png;base64,${logoPng.toString("base64")}`;

/**
 * Рендерира логото при даден размер.
 * fullBleed = тъмен фон до ръба (за maskable/apple икони — без прозрачни ъгли).
 */
async function render(page, size, { fullBleed = false } = {}) {
  const body = fullBleed
    ? `<div style="width:${size}px;height:${size}px;background:#1c2420;display:grid;place-items:center">
         <img src="${logoUri}" style="width:${Math.round(size * 0.92)}px;height:${Math.round(size * 0.92)}px" />
       </div>`
    : `<div style="width:${size}px;height:${size}px"><img src="${logoUri}" style="width:100%;height:100%" /></div>`;
  await page.setContent(`<!doctype html><body style="margin:0;background:transparent">${body}</body>`);
  await page.setViewportSize({ width: size, height: size });
  return page.screenshot({ omitBackground: !fullBleed, type: "png" });
}

/** Опакова единичен PNG в .ico контейнер (валидно от Vista насам). */
function pngToIco(png, size) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // 1 изображение
  header.writeUInt8(size >= 256 ? 0 : size, 6); // width
  header.writeUInt8(size >= 256 ? 0 : size, 7); // height
  header.writeUInt8(0, 8); // палитра
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bpp
  header.writeUInt32LE(png.length, 14); // размер на данните
  header.writeUInt32LE(22, 18); // offset
  return Buffer.concat([header, png]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

writeFileSync(resolve(root, "public/icons/icon-192.png"), await render(page, 192));
writeFileSync(resolve(root, "public/icons/icon-512.png"), await render(page, 512, { fullBleed: true }));
writeFileSync(resolve(root, "src/app/apple-icon.png"), await render(page, 180, { fullBleed: true }));
writeFileSync(resolve(root, "src/app/icon.png"), await render(page, 64));
writeFileSync(resolve(root, "src/app/favicon.ico"), pngToIco(await render(page, 32), 32));

await browser.close();
console.log("Иконите са генерирани: icon, icon-192, icon-512, apple-icon, favicon.ico");
