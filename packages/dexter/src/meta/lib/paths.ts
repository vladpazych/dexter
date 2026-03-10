/**
 * Path utilities for finding repo root.
 */

import { spawnSync } from "node:child_process"
import { existsSync, realpathSync } from "node:fs"

/**
 * Find the repo root by asking git for the worktree root.
 * Returns absolute path or throws if not found.
 */
export function findRepoRoot(): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  })
  if (result.status === 0 && result.error === undefined) {
    const root = result.stdout.trim()
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
