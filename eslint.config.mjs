import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**", "coverage/**", ".vercel/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    settings: { react: { version: "detect" } },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "react/prop-types": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: [
      "api/**/*.js",
      "server/**/*.js",
      "tests/**/*.cjs",
      "*.config.cjs",
      "postcss.config.js",
      "tailwind.config.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node, fetch: "readonly" },
    },
  },
];
