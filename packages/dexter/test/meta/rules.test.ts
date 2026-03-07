import { describe, expect, it } from "bun:test"
import { rules } from "../../src/meta/domain/rules.ts"
import { mockPorts } from "./mocks.ts"

import type { FsPort, GitPort } from "../../src/meta/ports.ts"
import type { QueryResult } from "../../src/meta/types.ts"

type RulesResult = Extract<QueryResult, { what: "rules" }>

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

const emptyGit: GitPort = {
  run: () => ({ success: true, stdout: "", stderr: "" }),
  checkIgnore: () => false,
}

describe("query rules", () => {
  it("resolves cascade for a scope", () => {
    const ports = mockPorts({
      fs: cascadeFs("/repo", {
        "CLAUDE.md": "root",
        "meta/CLAUDE.md": "meta rules",
      }),
      git: emptyGit,
    })

    const result = rules(ports, ["meta"]) as RulesResult
    expect(result.what).toBe("rules")
    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.path).toBe("meta")
    expect(result.data[0]!.cascade).toContain("@CLAUDE.md")
    expect(result.data[0]!.cascade).toContain("@meta/CLAUDE.md")
  })

  it("resolves multiple scopes", () => {
    const ports = mockPorts({
      fs: cascadeFs("/repo", {
        "CLAUDE.md": "root",
        "meta/CLAUDE.md": "meta",
        "lib/CLAUDE.md": "lib",
      }),
      git: emptyGit,
    })

    const result = rules(ports, ["meta", "lib"]) as RulesResult
    expect(result.data).toHaveLength(2)
    expect(result.data[0]!.path).toBe("meta")
    expect(result.data[1]!.path).toBe("lib")
  })

  it("returns empty data when no CLAUDE.md files exist", () => {
    const ports = mockPorts({
      fs: cascadeFs("/repo", {}),
      git: emptyGit,
    })

    const result = rules(ports, ["meta"]) as RulesResult
    expect(result.data).toHaveLength(0)
  })

  it("resolves deep cascade", () => {
    const ports = mockPorts({
      fs: cascadeFs("/repo", {
        "CLAUDE.md": "root",
        "apps/CLAUDE.md": "apps",
        "apps/dimas-web/CLAUDE.md": "dimas-web",
      }),
      git: emptyGit,
    })

    const result = rules(ports, ["apps/dimas-web/src/index.ts"]) as RulesResult
    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.cascade).toContain("@CLAUDE.md")
    expect(result.data[0]!.cascade).toContain("@apps/CLAUDE.md")
    expect(result.data[0]!.cascade).toContain("@apps/dimas-web/CLAUDE.md")
  })
})
