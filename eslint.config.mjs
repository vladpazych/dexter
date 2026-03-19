import tsPlugin from "@typescript-eslint/eslint-plugin"

/** @type {import("eslint").Linter.Config[]} */
const typescriptRecommended = tsPlugin.configs["flat/recommended"]

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.node_modules*/**",
      "**/dist/**",
      "**/.test-build/**",
      "**/*.d.ts",
      "**/.vite/**",
    ],
  },
  ...typescriptRecommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    files: ["**/*.{test,spec}.{ts,tsx}", "**/test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]
