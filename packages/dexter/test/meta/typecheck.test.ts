import { describe, expect, it } from "bun:test"
import { typecheck } from "../../src/meta/domain/typecheck.ts"
import { mockPorts, mockProcessHandle, createWorkspaceFs } from "./mocks.ts"

import type { QueryResult } from "../../src/meta/types.ts"

type CheckResult = Extract<QueryResult, { what: "typecheck" }>

function typecheckPorts(exitCode = 0, output = "") {
  const spawned: Array<{ cwd: string }> = []
  const ports = mockPorts({
    fs: createWorkspaceFs(),
    process: {
      spawn(params) {
        spawned.push({ cwd: params.cwd })
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

describe("query typecheck", () => {
  it("runs typecheck in matching packages", async () => {
    const { ports, spawned } = typecheckPorts()

    const result = await typecheck(ports, ["apps"])
    expect(result.what).toBe("typecheck")
    // apps/control and apps/web both have typecheck
    expect(spawned.length).toBe(2)
    expect(spawned.map((s) => s.cwd).sort()).toEqual(["/repo/apps/control", "/repo/apps/web"])
  })

  it("returns zero errors when scope has no typecheck script", async () => {
    const { ports } = typecheckPorts()

    const result = (await typecheck(ports, ["nonexistent"])) as CheckResult
    expect(result.data.errorCount).toBe(0)
    expect(result.data.errors).toEqual([])
  })

  it("returns structured check data on failure", async () => {
    const errorOutput = "src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'"
    const { ports } = typecheckPorts(1, errorOutput)

    const result = (await typecheck(ports, ["apps/control"])) as CheckResult
    expect(result.data.errorCount).toBe(1)
    expect(result.data.errors[0]!.summary).toContain("TS2322")
    expect(result.data.raw).toContain("TS2322")
  })

  it("returns zero errors on success", async () => {
    const { ports } = typecheckPorts(0)

    const result = (await typecheck(ports, ["apps"])) as CheckResult
    expect(result.data.errorCount).toBe(0)
  })
})
