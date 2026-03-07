/**
 * Path utilities for finding repo root.
 */

import { existsSync, realpathSync } from "node:fs"
import { dirname, join } from "node:path"

/**
 * Find the repo root by looking for CLAUDE.md, starting from CWD.
 * Returns absolute path or throws if not found.
 */
export function findRepoRoot(): string {
  let dir = process.cwd()

  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "CLAUDE.md"))) {
      return dir
    }
    dir = dirname(dir)
  }

  throw new Error("error: not in a repo (no CLAUDE.md found)")
}

/**
 * Check if a file path is inside the repo root.
 * Resolves symlinks — files behind symlinks pointing outside are excluded.
 */
export function isInsideRepo(filePath: string, root: string): boolean {
  try {
    const real = realpathSync(filePath)
    return real.startsWith(root + "/") || real === root
  } catch {
    return false
  }
}
