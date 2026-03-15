import { describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { files } from "../../src/index.ts"

function createRepoTree(): string {
  const root = mkdtempSync(join(tmpdir(), "dexter-files-"))
  mkdirSync(join(root, "apps/web/src/nested"), { recursive: true })
  writeFileSync(join(root, "AGENTS.md"), "root")
  writeFileSync(join(root, "apps/AGENTS.md"), "apps")
  writeFileSync(join(root, "apps/web/src/feature.ts"), "export {}")
  writeFileSync(join(root, "apps/web/src/feature.test.ts"), "test")
  writeFileSync(join(root, "apps/web/src/nested/deep.test.ts"), "deep")
  return root
}

describe("files", () => {
  it("collects ancestor files nearest first", () => {
    const root = createRepoTree()
    const repoFiles = files.with({ root })

    const result = repoFiles.collect({
      from: "apps/web/src",
      include: "AGENTS.md",
      walk: "up",
    })

    expect(result.map((match) => match.relPath)).toEqual([
      "apps/AGENTS.md",
      "AGENTS.md",
    ])
  })

  it("finds the target file itself when base is path", () => {
    const root = createRepoTree()
    const repoFiles = files.with({ root })

    const match = repoFiles.find({
      from: "apps/web/src/feature.test.ts",
      include: "*.test.ts",
      base: "path",
      walk: "here",
    })

    expect(match?.relPath).toBe("apps/web/src/feature.test.ts")
  })
})
