import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // We use plain <img> on purpose: next/image pulls in sharp, which is too
      // heavy for our 1.9 GB VPS. Avatars are small and already served optimized.
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "scripts/mock-*",
    "next-env.d.ts",
  ]),
]);
