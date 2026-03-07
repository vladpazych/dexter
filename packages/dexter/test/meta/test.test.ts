import { describe, expect, it } from "bun:test"
import { test as queryTest } from "../../src/meta/domain/test.ts"
import { mockPorts, mockProcessHandle, createWorkspaceFs } from "./mocks.ts"

import type { QueryResult } from "../../src/meta/types.ts"

type CheckResult = Extract<QueryResult, { what: "test" }>

function testPorts(exitCode = 0, output = "") {
  const spawned: Array<{ args: string[]; cwd: string }> = []
  const ports = mockPorts({
    fs: createWorkspaceFs(),
    process: {
      spawn(params) {
        spawned.push({ args: params.args, cwd: params.cwd })
        const handle = mockProcessHandle(exitCode)
        if (output) {
          const origWait = handle.wait
          const listeners: ((line: string) => void)[] = []
          handle.onLine = (stream, cb) => {
            if (stream === "stdout") listeners.push(cb)
          }
          handle.wait = () => {
            for (const line of output.split("\n").filter(Boolean)) {
              for (const cb of listeners) cb(line)
            }
            return origWait()
          }
        }
        return handle
      },
    },
  })
  return { ports, spawned }
}

describe("query test", () => {
  it("routes test files to correct package", async () => {
    const { ports, spawned } = testPorts()

    await queryTest(ports, ["apps/control/test/foo.test.ts"])
    expect(spawned.length).toBe(1)
    expect(spawned[0]!.cwd).toBe("/repo/apps/control")
    expect(spawned[0]!.args).toContain("test/foo.test.ts")
  })

  it("groups test files by package", async () => {
    const { ports, spawned } = testPorts()

    await queryTest(ports, [
      "apps/control/test/foo.test.ts",
      "apps/control/test/bar.test.ts",
      "lib/reel/test/baz.test.ts",
    ])
    expect(spawned.length).toBe(2)

    const controlSpawn = spawned.find((s) => s.cwd === "/repo/apps/control")!
    expect(controlSpawn.args).toContain("test/foo.test.ts")
    expect(controlSpawn.args).toContain("test/bar.test.ts")

    const reelSpawn = spawned.find((s) => s.cwd === "/repo/lib/reel")!
    expect(reelSpawn.args).toContain("test/baz.test.ts")
  })

  it("returns zero errors for unmatched files", async () => {
    const { ports } = testPorts()

    const result = (await queryTest(ports, ["nonexistent/test/foo.test.ts"])) as CheckResult
    expect(result.data.errorCount).toBe(0)
    expect(result.data.errors).toEqual([])
  })

  it("returns structured check data on failure", async () => {
    const failOutput = "✗ should handle empty input\n  Expected: hello\n  Received: undefined"
    const { ports } = testPorts(1, failOutput)

    const result = (await queryTest(ports, ["apps/control/test/foo.test.ts"])) as CheckResult
    expect(result.what).toBe("test")
    expect(result.data.errorCount).toBe(1)
    expect(result.data.errors[0]!.summary).toContain("✗ should handle empty input")
    expect(result.data.raw).toContain("✗ should handle empty input")
  })
})
