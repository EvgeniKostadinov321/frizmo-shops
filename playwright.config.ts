import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  /* 1 retry — поглъща редки timing флейкове без да маскира истински провали
     (истинският бъг пада и на retry-я). trace на retry за диагноза. */
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  /* Тестваме срещу ПРОД билд (не dev): dev компилира routes on-demand при първо
     посещение → непредсказуеми забавяния = флейк. Прод билдът е предкомпилиран. */
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
