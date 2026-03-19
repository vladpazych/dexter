import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, it } from "node:test"

import { process as rigProcess } from "@vladpazych/rig"

describe("process", () => {
  it("returns non-zero exits without throwing", async () => {
    const result = await rigProcess.run({
      cmd: globalThis.process.execPath,
      args: ["-e", "process.exit(3)"],
    })

    assert.equal(result.exitCode, 3)
    assert.equal(result.signal, null)
    assert.equal(result.error, undefined)
  })

  it("captures child output as plain line events", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "rig-process-"))
    const seen: string[] = []

    const result = await rigProcess.run({
      cmd: globalThis.process.execPath,
      args: ["-e", "console.log('hello')"],
      cwd,
      onLine(line) {
        seen.push(`${line.stream}:${line.line}`)
      },
    })

    assert.equal(result.exitCode, 0)
    assert.deepEqual(seen, ["stdout:hello"])
    assert.equal(result.stdout, "hello")
    assert.equal(result.stderr, "")
  })

  it("supports stdin input", async () => {
    const result = await rigProcess.run({
      cmd: globalThis.process.execPath,
      args: [
        "-e",
        "process.stdin.setEncoding('utf8'); let input=''; process.stdin.on('data', (chunk) => { input += chunk }); process.stdin.on('end', () => { console.log(input.toUpperCase()) })",
      ],
      stdin: "rig",
    })

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, "RIG")
  })

  it("binds default cwd and env with with()", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "rig-process-with-"))
    const bound = rigProcess.with({
      cwd,
      env: {
        TEST_VALUE: "bound",
      },
    })

    const result = await bound.run({
      cmd: globalThis.process.execPath,
      args: ["-e", "console.log(process.env.TEST_VALUE ?? 'missing')"],
    })

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, "bound")
  })

  it("supports stop() for long-lived child processes", async () => {
    const handle = rigProcess.spawn({
      cmd: globalThis.process.execPath,
      args: ["-e", "setInterval(() => {}, 1000)"],
    })

    setTimeout(() => {
      handle.stop("SIGTERM")
    }, 20)

    const result = await handle.wait()

    assert.equal(result.exitCode, null)
    assert.equal(result.signal, "SIGTERM")
  })

  it("supports listener unsubscribe for line events", async () => {
    const seen: string[] = []
    const handle = rigProcess.spawn({
      cmd: globalThis.process.execPath,
      args: [
        "-e",
        "console.log('first'); setTimeout(() => console.log('second'), 20)",
      ],
    })

    const unsubscribe = handle.onLine((line) => {
      seen.push(line.line)

      if (line.line === "first") {
        unsubscribe()
      }
    })

    const result = await handle.wait()

    assert.equal(result.exitCode, 0)
    assert.deepEqual(seen, ["first"])
  })

  it("emits lifecycle sink callbacks", async () => {
    const starts: string[] = []
    const lines: string[] = []
    const finishes: number[] = []

    const result = await rigProcess.run({
      cmd: globalThis.process.execPath,
      args: ["-e", "console.log('hello'); console.error('oops')"],
      sink: {
        onStart(start) {
          starts.push(`${start.cmd}:${start.cwd}`)
        },
        onLine(line) {
          lines.push(`${line.stream}:${line.line}`)
        },
        onFinish(finish) {
          finishes.push(finish.exitCode ?? -1)
        },
      },
    })

    assert.equal(result.exitCode, 0)
    assert.equal(starts.length, 1)
    assert.deepEqual(lines, ["stdout:hello", "stderr:oops"])
    assert.deepEqual(finishes, [0])
  })

  it("does not inject repo-specific env defaults", async () => {
    const result = await rigProcess.run({
      cmd: globalThis.process.execPath,
      args: [
        "-e",
        "console.log(JSON.stringify({ forceColor: process.env.FORCE_COLOR ?? null, logFormat: process.env.LOG_FORMAT ?? null, devRunner: process.env.DEV_RUNNER ?? null }))",
      ],
      env: {
        FORCE_COLOR: "",
        LOG_FORMAT: "",
        DEV_RUNNER: "",
      },
    })

    assert.equal(result.exitCode, 0)
    assert.equal(
      result.stdout,
      JSON.stringify({
        forceColor: "",
        logFormat: "",
        devRunner: "",
      }),
    )
  })

  it("cleans up signal listeners after the child exits", async () => {
    const sigintBefore = globalThis.process.listenerCount("SIGINT")
    const sigtermBefore = globalThis.process.listenerCount("SIGTERM")

    const result = await rigProcess.run({
      cmd: globalThis.process.execPath,
      args: ["-e", "console.log('done')"],
    })

    assert.equal(result.exitCode, 0)
    assert.equal(globalThis.process.listenerCount("SIGINT"), sigintBefore)
    assert.equal(globalThis.process.listenerCount("SIGTERM"), sigtermBefore)
  })

  it("captures child spawn failures in the result", async () => {
    const result = await rigProcess.run({
      cmd: "rig-command-that-does-not-exist",
      args: [],
    })

    assert.equal(result.exitCode, null)
    assert.equal(result.signal, null)
    assert.notEqual(result.error, undefined)
    assert.equal(result.error?.name, "Error")
  })
})
