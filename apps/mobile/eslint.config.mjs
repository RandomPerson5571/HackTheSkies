import { config } from "@repo/eslint-config/react-internal";

export default [
  ...config,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { process: "readonly" },
      parserOptions: {
        babelOptions: { parserOpts: { plugins: ["jsx"] } },
      },
    },
    // TypeScript checks declarations and unused imports, including JSX and types.
    rules: { "no-undef": "off", "no-unused-vars": "off" },
  },
  {
    files: ["**/*.{mjs,js,cjs}"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  { ignores: [".expo/**", "dist/**", "android/**", "ios/**"] },
];
