/**
 * ESLint integration for post-write hooks.
 *
 * Auto-fixes a file, returns remaining (unfixable) violations as text.
 */

import { dirname, join } from "node:path"
import { existsSync } from "node:fs"

/** Walk up from filePath to find the nearest directory containing package.json */
function findPackageRoot(filePath: string): string | undefined {
  let dir = dirname(filePath)
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) return dir
    dir = dirname(dir)
  }
  return undefined
}

/** Auto-fix a file, return remaining violations as text (empty string = clean) */
export function runESLint(filePath: string): string {
  const cwd = findPackageRoot(filePath)
  const result = Bun.spawnSync(["bunx", "eslint", "--fix", "--no-warn-ignored", filePath], {
    stdout: "pipe",
    stderr: "pipe",
    ...(cwd && { cwd }),
  })

  // eslint prints remaining (unfixable) violations to stdout
  return result.stdout.toString().trim()
}

/** Check if a file should be linted */
export function shouldLint(filePath: string): boolean {
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) {
    return false
  }

  const skipPatterns = [
    "/node_modules/",
    "/dist/",
    "/.next/",
    "/coverage/",
    ".d.ts",
    "/routeTree.gen.ts",
    "/storybook-static/",
    "/.storybook/",
    "/.vite/",
  ]

  for (const pattern of skipPatterns) {
    if (filePath.includes(pattern)) {
      return false
    }
  }

  return true
}
