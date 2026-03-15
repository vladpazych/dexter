import { describe, expect, it } from "bun:test"
import { mkdtempSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { pipe } from "../../src/index.ts"

describe("pipe", () => {
  it("captures structured child output as typed events", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "dexter-pipe-"))
    const events: string[] = []

    const result = await pipe.exec({
      source: "test",
      cmd: process.execPath,
      args: [
        "-e",
        "console.log(JSON.stringify({ level: 30, msg: 'hello', time: 1 }))",
      ],
      cwd,
      onEvent(event) {
        events.push(event.message)
      },
    })

    expect(result.exitCode).toBe(0)
    expect(events).toEqual(["hello"])
  })

  it("binds default cwd and env with with()", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "dexter-pipe-with-"))
    const bound = pipe.with({
      cwd,
      env: {
        TEST_VALUE: "bound",
      },
    })
    const seen: string[] = []

    const result = await bound.exec({
      source: "bound",
      cmd: process.execPath,
      args: [
        "-e",
        "console.log(JSON.stringify({ level: 30, msg: process.env.TEST_VALUE, time: 1 }))",
      ],
      onEvent(event) {
        seen.push(event.message)
      },
    })

    expect(result.exitCode).toBe(0)
    expect(seen).toEqual(["bound"])
  })

  it("executes into a sink", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "dexter-pipe-sink-"))
    const seen: string[] = []

    const result = await pipe.exec({
      source: "vite",
      cmd: process.execPath,
      args: [
        "-e",
        "console.log(JSON.stringify({ level: 30, msg: 'compiled', time: 1 }))",
      ],
      cwd,
      sink: {
        onEvent(event) {
          seen.push(event.message)
        },
      },
    })

    expect(result.exitCode).toBe(0)
    expect(seen).toEqual(["compiled"])
  })
})
