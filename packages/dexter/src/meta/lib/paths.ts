/**
 * Path utilities for finding repo root.
 */

import { existsSync, realpathSync } from "node:fs"
import { join } from "node:path"

/**
 * Find the repo root by asking git for the worktree root.
 * Returns absolute path or throws if not found.
 */
export function findRepoRoot(): string {
  const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
    stdout: "pipe",
    stderr: "pipe",
  })
  if (result.success) {
    const root = result.stdout.toString().trim()
    if (root) return realpathSync(root)
  }

  throw new Error("error: not in a git repository")
}

/**
 * Check if a file path is inside the repo root.
 * Resolves symlinks — files behind symlinks pointing outside are excluded.
 */
export function isInsideRepo(filePath: string, root: string): boolean {
  try {
    const real = realpathSync(filePath)
    const repoRoot = existsSync(root) ? realpathSync(root) : root
    return real.startsWith(repoRoot + "/") || real === repoRoot
  } catch {
    return false
  }
}
