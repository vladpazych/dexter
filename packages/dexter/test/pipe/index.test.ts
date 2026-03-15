import { describe, expect, it } from "bun:test"
import { mkdtempSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { pipe } from "../../src/index.ts"

describe("pipe", () => {
  it("runs a process and writes parsed output to the log file", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "dexter-pipe-"))
    const logFile = join(cwd, "pipe.log")

    const exitCode = await pipe.run({
      name: "test",
      cmd: process.execPath,
      args: ["-e", "console.log(JSON.stringify({ level: 30, msg: 'hello', time: 1 }))"],
      cwd,
      logFile,
    })

    expect(exitCode).toBe(0)
    expect(readFileSync(logFile, "utf8")).toContain("hello")
  })

  it("binds default cwd and env with with()", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "dexter-pipe-with-"))
    const logFile = join(cwd, "pipe.log")
    const bound = pipe.with({
      cwd,
      env: {
        TEST_VALUE: "bound",
      },
    })

    const exitCode = await bound.run({
      name: "bound",
      cmd: process.execPath,
      args: ["-e", "console.log(JSON.stringify({ level: 30, msg: process.env.TEST_VALUE, time: 1 }))"],
      logFile,
    })

    expect(exitCode).toBe(0)
    expect(readFileSync(logFile, "utf8")).toContain("bound")
  })
})
