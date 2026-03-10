import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { findRepoRoot } from "../../../src/meta/lib/paths.ts"

function createGitRepo(): { root: string; nested: string } {
  const root = mkdtempSync(join(tmpdir(), "dexter-paths-"))
  const nested = join(root, "packages", "tool")
  mkdirSync(nested, { recursive: true })
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "repo" }))
  Bun.spawnSync(["git", "init", "-q"], { cwd: root })
  return { root, nested }
}

describe("findRepoRoot", () => {
  const originalCwd = process.cwd()

  beforeEach(() => {
    process.exitCode = undefined
  })

  afterEach(() => {
    process.chdir(originalCwd)
    process.exitCode = undefined
  })

  it("returns the git worktree root from nested directories", () => {
    const { root, nested } = createGitRepo()
    process.chdir(nested)
    expect(findRepoRoot()).toBe(realpathSync(root))
  })

  it("throws outside a git repository", () => {
    const dir = mkdtempSync(join(tmpdir(), "dexter-no-git-"))
    process.chdir(dir)
    expect(() => findRepoRoot()).toThrow("error: not in a git repository")
  })
})
