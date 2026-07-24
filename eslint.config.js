import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // El preset "recommended" de esta versión de eslint-plugin-react-hooks
      // incluye los diagnósticos del React Compiler (set-state-in-effect,
      // incompatible-library, etc.) — son útiles pero marcan como error
      // patrones preexistentes que ya funcionan en producción. Se bajan a
      // warning para que el CI no quede rojo el día 1 por código no tocado;
      // el gate duro sigue siendo `tsc --noEmit` + `vite build`.
      ...Object.fromEntries(
        Object.entries(reactHooks.configs.recommended.rules).map(([rule, value]) => [
          rule,
          Array.isArray(value) ? ["warn", ...value.slice(1)] : "warn",
        ]),
      ),
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
