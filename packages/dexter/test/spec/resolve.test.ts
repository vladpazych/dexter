import { describe, expect, it } from "bun:test"

import { resolveSpecFiles } from "../../src/spec/index.ts"
import type { FsPort, RepoPorts } from "../../src/meta/ports.ts"
import { mockPorts } from "../meta/mocks.ts"

function createSpecFs(): FsPort {
  const files = new Map<string, string>([
    ["/repo/AGENTS.md", "root"],
    ["/repo/apps/AGENTS.md", "apps"],
    ["/repo/apps/web/README.md", "web"],
    ["/repo/apps/web/src/feature.ts", "export {}"],
    ["/repo/apps/web/src/feature.test.ts", "test"],
    ["/repo/apps/web/src/nested/deep.test.ts", "deep"],
    ["/repo/apps/web/src/nested/helper.ts", "helper"],
  ])

  const dirs = new Map<string, Array<{ name: string; isDirectory: boolean }>>([
    [
      "/repo",
      [
        { name: "AGENTS.md", isDirectory: false },
        { name: "apps", isDirectory: true },
      ],
    ],
    [
      "/repo/apps",
      [
        { name: "AGENTS.md", isDirectory: false },
        { name: "web", isDirectory: true },
      ],
    ],
    [
      "/repo/apps/web",
      [
        { name: "README.md", isDirectory: false },
        { name: "src", isDirectory: true },
      ],
    ],
    [
      "/repo/apps/web/src",
      [
        { name: "feature.ts", isDirectory: false },
        { name: "feature.test.ts", isDirectory: false },
        { name: "nested", isDirectory: true },
      ],
    ],
    [
      "/repo/apps/web/src/nested",
      [
        { name: "deep.test.ts", isDirectory: false },
        { name: "helper.ts", isDirectory: false },
      ],
    ],
  ])

  return {
    exists: (path) => files.has(path) || dirs.has(path),
    readFile: (path) => {
      const value = files.get(path)
      if (value === undefined) throw new Error(`ENOENT: ${path}`)
      return value
    },
    writeFile: () => {},
    readBytes: (path) => {
      const value = files.get(path)
      if (value === undefined) throw new Error(`ENOENT: ${path}`)
      return new TextEncoder().encode(value)
    },
    writeBytes: () => {},
    readDir: (path) => {
      const entries = dirs.get(path)
      if (entries === undefined) throw new Error(`ENOTDIR: ${path}`)
      return entries
    },
    unlink: () => {},
    rmdir: () => {},
    mkdir: () => {},
    rename: () => {},
  }
}

function createSpecPorts(): RepoPorts {
  return mockPorts({
    root: "/repo",
    fs: createSpecFs(),
    glob: {
      match(pattern, candidates) {
        const glob = new Bun.Glob(pattern)
        return candidates.filter((candidate) => glob.match(candidate))
      },
    },
  })
}

describe("resolveSpecFiles", () => {
  it("resolves ancestor specs nearest first from the target directory", () => {
    const result = resolveSpecFiles(createSpecPorts(), "apps/web/src", [
      {
        name: "agents",
        include: "AGENTS.md",
        walk: "up",
      },
    ])

    expect(result.matches.agents?.map((match) => match.relPath)).toEqual(["apps/AGENTS.md", "AGENTS.md"])
    expect(result.matches.agents?.map((match) => match.distance)).toEqual([2, 3])
  })

  it("can resolve the target file itself when from is target", () => {
    const result = resolveSpecFiles(createSpecPorts(), "apps/web/src/feature.test.ts", [
      {
        name: "self",
        include: "*.test.ts",
        from: "target",
        walk: "here",
      },
    ])

    expect(result.matches.self).toEqual([
      {
        query: "self",
        path: "/repo/apps/web/src/feature.test.ts",
        relPath: "apps/web/src/feature.test.ts",
        relation: "self",
        distance: 0,
        anchorDir: "/repo/apps/web/src",
      },
    ])
  })

  it("collects descendant specs in path order and respects maxDepth", () => {
    const result = resolveSpecFiles(createSpecPorts(), "apps/web/src", [
      {
        name: "tests",
        include: "**/*.test.ts",
        walk: "down",
        maxDepth: 1,
      },
    ])

    expect(result.matches.tests?.map((match) => match.relPath)).toEqual([
      "apps/web/src/feature.test.ts",
      "apps/web/src/nested/deep.test.ts",
    ])
  })

  it("can stop ancestor traversal before repo root", () => {
    const result = resolveSpecFiles(createSpecPorts(), "apps/web/src", [
      {
        name: "agents",
        include: "AGENTS.md",
        walk: "up",
        stopAt: "apps",
      },
    ])

    expect(result.matches.agents?.map((match) => match.relPath)).toEqual(["apps/AGENTS.md"])
  })

  it("rejects duplicate query names", () => {
    expect(() =>
      resolveSpecFiles(createSpecPorts(), "apps/web/src", [
        {
          name: "dup",
          include: "AGENTS.md",
          walk: "up",
        },
        {
          name: "dup",
          include: "README.md",
          walk: "here",
        },
      ]),
    ).toThrow("Duplicate spec query name: dup")
  })
})
