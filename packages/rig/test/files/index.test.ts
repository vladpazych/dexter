import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, it } from "node:test"

import { files } from "@vladpazych/rig"

function createRepoTree(): string {
  const root = mkdtempSync(join(tmpdir(), "rig-files-"))
  mkdirSync(join(root, "apps/web/src/nested/more"), { recursive: true })
  writeFileSync(join(root, "AGENTS.md"), "root")
  writeFileSync(join(root, "apps/AGENTS.md"), "apps")
  writeFileSync(join(root, "apps/web/AGENTS.md"), "web")
  writeFileSync(join(root, "apps/web/src/AGENTS.md"), "src")
  writeFileSync(join(root, "apps/web/src/nested/AGENTS.md"), "nested")
  writeFileSync(join(root, "apps/web/src/feature.ts"), "export {}")
  writeFileSync(join(root, "apps/web/src/feature.test.ts"), "test")
  writeFileSync(join(root, "apps/web/src/helper.test.ts"), "helper")
  writeFileSync(join(root, "apps/web/src/nested/deep.test.ts"), "deep")
  writeFileSync(join(root, "apps/web/src/nested/more/deeper.test.ts"), "deeper")
  return root
}

describe("files", () => {
  it("resolves relative queries from the bound root", () => {
    const root = createRepoTree()
    const repoFiles = files.with({ root })

    const match = repoFiles.find({
      from: "apps/web/src/feature.test.ts",
      include: "*.test.ts",
      base: "path",
      walk: "here",
    })

    assert.equal(match?.relPath, "apps/web/src/feature.test.ts")
  })

  it("collects ancestor files nearest first", () => {
    const root = createRepoTree()
    const repoFiles = files.with({ root })

    const result = repoFiles.collect({
      from: "apps/web/src/nested",
      include: "AGENTS.md",
      walk: "up",
    })

    assert.deepEqual(
      result.map((match) => match.relPath),
      [
        "apps/web/src/nested/AGENTS.md",
        "apps/web/src/AGENTS.md",
        "apps/web/AGENTS.md",
        "apps/AGENTS.md",
        "AGENTS.md",
      ],
    )
  })

  it("supports stopAt and nearest-last ordering during upward walks", () => {
    const root = createRepoTree()
    const repoFiles = files.with({ root })

    const result = repoFiles.collect({
      from: "apps/web/src/nested",
      include: "AGENTS.md",
      walk: "up",
      stopAt: "apps",
      order: "nearest-last",
    })

    assert.deepEqual(
      result.map((match) => match.relPath),
      [
        "apps/AGENTS.md",
        "apps/web/AGENTS.md",
        "apps/web/src/AGENTS.md",
        "apps/web/src/nested/AGENTS.md",
      ],
    )
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

    assert.equal(match?.relPath, "apps/web/src/feature.test.ts")
  })

  it("skips the base path when includeBase is false", () => {
    const root = createRepoTree()
    const repoFiles = files.with({ root })

    const match = repoFiles.find({
      from: "apps/web/src/feature.test.ts",
      include: "*.test.ts",
      base: "path",
      walk: "here",
      includeBase: false,
    })

    assert.equal(match, undefined)
  })

  it("walks down with path ordering and exclude filters", () => {
    const root = createRepoTree()
    const repoFiles = files.with({ root })

    const result = repoFiles.collect({
      from: "apps/web/src",
      include: ["*.test.ts", "**/*.test.ts"],
      exclude: ["nested/**"],
      walk: "down",
      order: "path",
    })

    assert.deepEqual(
      result.map((match) => match.relPath),
      ["apps/web/src/feature.test.ts", "apps/web/src/helper.test.ts"],
    )
  })

  it("respects maxDepth when walking down", () => {
    const root = createRepoTree()
    const repoFiles = files.with({ root })

    const result = repoFiles.collect({
      from: "apps/web/src",
      include: ["*.test.ts", "**/*.test.ts"],
      walk: "down",
      maxDepth: 0,
    })

    assert.deepEqual(
      result.map((match) => match.relPath),
      ["apps/web/src/feature.test.ts", "apps/web/src/helper.test.ts"],
    )
  })

  it("supports pick:first with the default path ordering for downward walks", () => {
    const root = createRepoTree()
    const repoFiles = files.with({ root })

    const match = repoFiles.find({
      from: "apps/web/src",
      include: ["*.test.ts", "**/*.test.ts"],
      walk: "down",
    })

    assert.equal(match?.relPath, "apps/web/src/feature.test.ts")
  })

  it("validates query fields consistently", () => {
    const root = createRepoTree()
    const repoFiles = files.with({ root })
    const invalidQueries = [
      {
        query: { from: " ", include: "AGENTS.md", walk: "up" },
        pattern: /files query 'from' must be a non-empty string/,
      },
      {
        query: { from: "apps", include: "", walk: "up" },
        pattern: /files query 'include' must not be empty/,
      },
      {
        query: {
          from: "apps",
          include: "AGENTS.md",
          exclude: [""],
          walk: "up",
        },
        pattern: /files query 'exclude' must contain only non-empty strings/,
      },
      {
        query: { from: "apps", include: "AGENTS.md", walk: "sideways" },
        pattern: /files query 'walk' must be one of/,
      },
      {
        query: { from: "apps", include: "AGENTS.md", walk: "up", base: "file" },
        pattern: /files query 'base' must be one of/,
      },
      {
        query: {
          from: "apps",
          include: "AGENTS.md",
          walk: "up",
          includeBase: "yes",
        },
        pattern: /files query 'includeBase' must be a boolean/,
      },
      {
        query: { from: "apps", include: "AGENTS.md", walk: "up", maxDepth: -1 },
        pattern: /files query 'maxDepth' must be a non-negative integer/,
      },
      {
        query: { from: "apps", include: "AGENTS.md", walk: "up", stopAt: "" },
        pattern: /files query 'stopAt' must not be empty/,
      },
      {
        query: { from: "apps", include: "AGENTS.md", walk: "up", pick: "last" },
        pattern: /files query 'pick' must be one of/,
      },
      {
        query: {
          from: "apps",
          include: "AGENTS.md",
          walk: "up",
          order: "depth",
        },
        pattern: /files query 'order' must be one of/,
      },
    ] as const

    for (const testCase of invalidQueries) {
      assert.throws(
        () => repoFiles.collect(testCase.query as never),
        testCase.pattern,
      )
    }
  })
})
