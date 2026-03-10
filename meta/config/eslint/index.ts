import type { ESLint, Linter } from "eslint"
import tsParser from "@typescript-eslint/parser"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import prettierConfig from "eslint-config-prettier"

export { prettierConfig }

const typescriptPlugin = tsPlugin as unknown as ESLint.Plugin

export const ignores: Linter.Config = {
  ignores: ["**/node_modules/**", "**/dist/**", "**/*.d.ts", "**/.vite/**"],
}

export const typescript: Linter.Config = {
  files: ["**/*.{ts,tsx,mts,mjs,cts,cjs}"],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      projectService: true,
    },
  },
  plugins: {
    "@typescript-eslint": typescriptPlugin,
  },
  rules: {
    ...tsPlugin.configs.recommended.rules,
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/triple-slash-reference": "off",
    "@typescript-eslint/no-empty-object-type": "off",
  },
}

export const testFiles: Linter.Config = {
  files: ["**/*.{test,spec}.{ts,tsx}", "**/test/**/*.{ts,tsx}"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  },
}

export function defineConfig(...configs: Linter.Config[]): Linter.Config[] {
  return [ignores, typescript, testFiles, ...configs, prettierConfig]
}

export default defineConfig()
