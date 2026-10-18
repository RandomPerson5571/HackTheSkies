import { config } from "@repo/eslint-config/react-internal";

export default [
  ...config,
  {
    languageOptions: {
      parserOptions: {
        // Lint syntax without executing Metro's Babel transforms. ESLint and
        // Expo use separate Babel versions and do not share transform plugins.
        babelOptions: { babelrc: false, configFile: false },
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { process: "readonly" },
      parserOptions: {
        babelOptions: { parserOpts: { plugins: ["typescript", "jsx"] } },
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
