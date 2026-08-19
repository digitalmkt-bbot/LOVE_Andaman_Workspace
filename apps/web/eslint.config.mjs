import { globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  globalIgnores([".next/**", "coverage/**", "node_modules/**"]),
];
