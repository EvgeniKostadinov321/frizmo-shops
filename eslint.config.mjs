import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Аргументи/променливи с _ префикс са умишлено неизползвани
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Motion се ползва само през m. + LazyMotion (bundle дисциплина) —
      // виж src/components/marketing/motion-provider.tsx
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "motion/react",
              importNames: ["motion"],
              message:
                "Използвай `m` с LazyMotion вместо `motion` — виж src/components/marketing/motion-provider.tsx",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
