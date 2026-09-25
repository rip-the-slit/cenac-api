import js from "@eslint/js";
import globals from "globals";
export default [
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    rules: js.configs.recommended.rules,
    languageOptions: { globals: { ...globals.browser, ...globals.jest } },
  },
];
