import { describe, expect, it } from "bun:test"
import { commits } from "../../src/meta/domain/commits.ts"
import { mockPorts } from "./mocks.ts"

import type { GitPort } from "../../src/meta/ports.ts"
import type { QueryResult } from "../../src/meta/types.ts"

type CommitsResult = Extract<QueryResult, { what: "commits" }>

function gitWith(responses: Record<string, string> = {}): GitPort {
  return {
    run(args: string[]) {
      const key = args[0]!
      // Distinguish repo-wide log from scoped log by checking for "--"
      if (key === "log" && !args.includes("--")) {
        const stdout = responses["log-repo"] ?? responses[key] ?? ""
        return { success: true, stdout, stderr: "" }
      }
      const stdout = responses[key] ?? ""
      return { success: true, stdout, stderr: "" }
    },
    checkIgnore: () => false,
  }
}

describe("query commits", () => {
  it("includes scoped and repo-wide commits", () => {
    const ports = mockPorts({
      git: gitWith({
        log: "abc1234 impl: add feature (alice, 2 days ago)",
        "log-repo": "abc1234 impl: add feature\ndef5678 fix: bug",
      }),
    })

    const result = commits(ports, ["meta"]) as CommitsResult
    expect(result.what).toBe("commits")
    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.path).toBe("meta")
    expect(result.data[0]!.log).toContain("abc1234 impl: add feature (alice, 2 days ago)")
    expect(result.recent).toContain("abc1234 impl: add feature")
    expect(result.recent).toContain("def5678 fix: bug")
  })

  it("returns only repo-wide when scope has no commits", () => {
    const ports = mockPorts({
      git: gitWith({
        "log-repo": "abc1234 impl: feature",
      }),
    })

    const result = commits(ports, ["empty-scope"]) as CommitsResult
    expect(result.data).toHaveLength(0)
    expect(result.recent).toContain("abc1234 impl: feature")
  })

  it("handles multiple scopes", () => {
    const ports = mockPorts({
      git: gitWith({
        log: "abc1234 impl: something",
        "log-repo": "abc1234 impl: something",
      }),
    })

    const result = commits(ports, ["meta", "lib"]) as CommitsResult
    expect(result.data).toHaveLength(2)
    expect(result.data[0]!.path).toBe("meta")
    expect(result.data[1]!.path).toBe("lib")
  })
})
