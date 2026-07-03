/*
 * Генерира PWA/favicon иконите от бранд знака (src/app/icon.svg).
 * Пуска се ръчно при смяна на логото: node scripts/generate-icons.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const svg = readFileSync(resolve(root, "src/app/icon.svg"), "utf8");

/** Рендерира знака при даден размер; fullBleed = без прозрачни ъгли (за maskable/apple). */
async function render(page, size, { fullBleed = false } = {}) {
  const body = fullBleed
    ? /* Плътен фон + знак в безопасната зона (80%) за maskable/apple икони */
      `<div style="width:${size}px;height:${size}px;background:#0c6b41;display:grid;place-items:center">
         <div style="width:${Math.round(size * 0.8)}px;height:${Math.round(size * 0.8)}px">${svg.replace('rx="14"', 'rx="0" fill-opacity="0"').replace(/width="64" height="64"/, 'width="100%" height="100%"')}</div>
       </div>`
    : `<div style="width:${size}px;height:${size}px">${svg.replace(/width="64" height="64"/, 'width="100%" height="100%"')}</div>`;
  await page.setContent(
    `<!doctype html><body style="margin:0;background:transparent">${body}</body>`,
  );
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
writeFileSync(resolve(root, "src/app/favicon.ico"), pngToIco(await render(page, 32), 32));

/* OpenGraph изображение (1200×630) — знак + wordmark върху бранд градиент */
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<!doctype html><body style="margin:0">
  <div style="width:1200px;height:630px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;background:linear-gradient(135deg,#0a5c38,#07452a);font-family:'Segoe UI',system-ui,sans-serif">
    <div style="display:flex;align-items:center;gap:28px">
      <div style="width:110px;height:110px;border-radius:24px;background:rgba(255,255,255,.12);display:grid;place-items:center">${svg.replace('rx="14" fill="#0c6b41"', 'rx="0" fill-opacity="0"').replace(/width="64" height="64"/, 'width="72" height="72"')}</div>
      <div style="font-size:88px;font-weight:700;color:#fff;letter-spacing:-2px">Frizmo <span style="color:#8fd4b2">Shops</span></div>
    </div>
    <div style="font-size:38px;color:#bfe3d1">Твоят онлайн магазин. Готов днес. Без програмист.</div>
  </div>
</body>`);
writeFileSync(resolve(root, "src/app/opengraph-image.png"), await page.screenshot({ type: "png" }));

await browser.close();
console.log("Иконите са генерирани: icon-192, icon-512, apple-icon, favicon.ico");
