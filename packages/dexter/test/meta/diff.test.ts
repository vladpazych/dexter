import { describe, expect, it } from "bun:test"
import { diff } from "../../src/meta/domain/diff.ts"
import { mockPorts } from "./mocks.ts"

import type { GitPort } from "../../src/meta/ports.ts"
import type { QueryResult } from "../../src/meta/types.ts"

type DiffResult = Extract<QueryResult, { what: "diff" }>

function gitWith(responses: Record<string, string> = {}): GitPort {
  return {
    run(args: string[]) {
      const key = args[0]!
      const stdout = responses[key] ?? ""
      return { success: true, stdout, stderr: "" }
    },
    checkIgnore: () => false,
  }
}

describe("query diff", () => {
  it("includes status and diff", () => {
    const ports = mockPorts({
      git: gitWith({
        status: " M meta/src/index.ts",
        diff: "+new line\n-old line",
      }),
    })

    const result = diff(ports, ["meta"]) as DiffResult
    expect(result.what).toBe("diff")
    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.path).toBe("meta")
    expect(result.data[0]!.status).toContain("M meta/src/index.ts")
    expect(result.data[0]!.diff).toContain("+new line")
  })

  it("returns empty data when no changes", () => {
    const ports = mockPorts({ git: gitWith() })

    const result = diff(ports, ["meta"]) as DiffResult
    expect(result.data).toHaveLength(0)
  })

  it("truncates long diffs", () => {
    const lines = Array.from({ length: 300 }, (_, i) => `line ${i}`)
    const ports = mockPorts({
      git: gitWith({ diff: lines.join("\n") }),
    })

    const result = diff(ports, ["apps"]) as DiffResult
    expect(result.data[0]!.diff).toContain("line 0")
    expect(result.data[0]!.diff).toContain("(100 more lines)")
    expect(result.data[0]!.diff).not.toContain("line 250")
  })

  it("handles multiple scopes", () => {
    const ports = mockPorts({
      git: gitWith({ status: " M file.ts" }),
    })

    const result = diff(ports, ["meta", "lib"]) as DiffResult
    expect(result.data).toHaveLength(2)
    expect(result.data[0]!.path).toBe("meta")
    expect(result.data[1]!.path).toBe("lib")
  })
})
