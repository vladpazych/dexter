import { describe, expect, it } from "bun:test"
import { scopeToDir, resolveCascade } from "../../src/meta/domain/scope-context.ts"
import { mockPorts } from "./mocks.ts"

import type { FsPort } from "../../src/meta/ports.ts"

function cascadeFs(root: string, specs: Record<string, string>): FsPort {
  const files: Record<string, string> = {}
  for (const [rel, content] of Object.entries(specs)) {
    files[`${root}/${rel}`] = content
  }
  return {
    exists: (path: string) => path in files,
    readFile: (path: string) => {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`)
      return files[path]!
    },
    writeFile: () => {},
    readDir: () => [],
    unlink: () => {},
    mkdir: () => {},
  }
}

describe("scopeToDir", () => {
  it("returns directory as-is", () => {
    expect(scopeToDir("apps/dimas-cli")).toBe("apps/dimas-cli")
  })

  it("strips trailing slash", () => {
    expect(scopeToDir("lib/dimas/")).toBe("lib/dimas")
  })

  it("strips filename from file path", () => {
    expect(scopeToDir("apps/dimas-cli/src/lib/prompt.ts")).toBe("apps/dimas-cli/src/lib")
  })

  it("returns . for root-level file", () => {
    expect(scopeToDir("package.json")).toBe(".")
  })

  it("extracts prefix from glob", () => {
    expect(scopeToDir("apps/dimas-web/src/**/*.tsx")).toBe("apps/dimas-web/src")
  })

  it("returns . for root glob", () => {
    expect(scopeToDir("**/*.ts")).toBe(".")
  })
})

describe("resolveCascade", () => {
  it("resolves root CLAUDE.md only", () => {
    const ports = mockPorts({
      fs: cascadeFs("/repo", { "CLAUDE.md": "root spec" }),
    })

    expect(resolveCascade(ports, ".")).toEqual(["@CLAUDE.md"])
  })

  it("resolves full cascade for nested directory", () => {
    const ports = mockPorts({
      fs: cascadeFs("/repo", {
        "CLAUDE.md": "root",
        "apps/CLAUDE.md": "apps layer",
        "apps/dimas-cli/CLAUDE.md": "dimas-cli project",
      }),
    })

    expect(resolveCascade(ports, "apps/dimas-cli/src/lib")).toEqual([
      "@CLAUDE.md",
      "@apps/CLAUDE.md",
      "@apps/dimas-cli/CLAUDE.md",
    ])
  })

  it("skips missing intermediate CLAUDE.md files", () => {
    const ports = mockPorts({
      fs: cascadeFs("/repo", {
        "CLAUDE.md": "root",
        "apps/dimas-cli/CLAUDE.md": "dimas-cli",
      }),
    })

    expect(resolveCascade(ports, "apps/dimas-cli/src")).toEqual(["@CLAUDE.md", "@apps/dimas-cli/CLAUDE.md"])
  })

  it("returns empty when no CLAUDE.md exists", () => {
    const ports = mockPorts({
      fs: cascadeFs("/repo", {}),
    })

    expect(resolveCascade(ports, "apps/foo")).toEqual([])
  })
})
