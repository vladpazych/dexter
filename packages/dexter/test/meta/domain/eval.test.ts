/**
 * Eval Domain Tests
 */

import { describe, expect, it } from "bun:test"

import { evaluate } from "../../../src/meta/domain/eval.ts"
import { ControlError } from "../../../src/meta/errors.ts"
import { mockPorts, mockProcessHandle } from "../mocks.ts"

function evalPorts(opts: { exitCode?: number; stdout?: string[]; stderr?: string[] } = {}) {
  const { exitCode = 0, stdout = [], stderr = [] } = opts
  const written: Array<{ path: string; content: string }> = []
  const deleted: string[] = []
  const spawned: Array<{ cmd: string; args: string[]; cwd: string; timeout?: number }> = []
  const writtenPaths = new Set<string>()

  const ports = mockPorts({
    fs: {
      exists: (path: string) => writtenPaths.has(path) || !path.includes(".scratch/eval-"),
      readFile: () => "",
      writeFile: (path: string, content: string) => {
        written.push({ path, content })
        writtenPaths.add(path)
      },
      readDir: () => [],
      unlink: (path: string) => deleted.push(path),
      mkdir: () => {},
    },
    process: {
      spawn(params) {
        spawned.push(params)
        const handle = mockProcessHandle(exitCode)
        // Emit lines after onLine is registered
        const origOnLine = handle.onLine
        handle.onLine = (stream, cb) => {
          origOnLine(stream, cb)
          const lines = stream === "stdout" ? stdout : stderr
          for (const line of lines) cb(line)
        }
        return handle
      },
    },
  })

  return { ports, written, deleted, spawned }
}

describe("evaluate", () => {
  it("throws on empty code", async () => {
    const { ports } = evalPorts()
    try {
      await evaluate(ports, { code: "" })
      expect.unreachable("should throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ControlError)
      expect((err as ControlError).code).toBe("empty_code")
    }
  })

  it("writes code to temp file and spawns bun run", async () => {
    const { ports, written, spawned } = evalPorts({ stdout: ["42"] })

    const result = await evaluate(ports, { code: "console.log(42)" })

    expect(result.ok).toBe(true)
    expect(result.stdout).toBe("42")
    expect(written.length).toBe(1)
    expect(written[0]!.content).toBe("console.log(42)")
    expect(spawned.length).toBe(1)
    expect(spawned[0]!.cmd).toBe("bun")
    expect(spawned[0]!.args[0]).toBe("run")
  })

  it("passes timeout to process spawn", async () => {
    const { ports, spawned } = evalPorts()

    await evaluate(ports, { code: "1", timeout: 3000 })

    expect(spawned[0]!.timeout).toBe(3000)
  })

  it("uses default timeout of 5000ms", async () => {
    const { ports, spawned } = evalPorts()

    await evaluate(ports, { code: "1" })

    expect(spawned[0]!.timeout).toBe(5000)
  })

  it("cleans up temp file after execution", async () => {
    const { ports, deleted } = evalPorts()

    await evaluate(ports, { code: "1" })

    expect(deleted.length).toBe(1)
    expect(deleted[0]).toContain("eval-")
  })

  it("returns ok: false on non-zero exit", async () => {
    const { ports } = evalPorts({ exitCode: 1, stderr: ["TypeError: x is not defined"] })

    const result = await evaluate(ports, { code: "x" })

    expect(result.ok).toBe(false)
    expect(result.stderr).toBe("TypeError: x is not defined")
  })

  it("captures both stdout and stderr", async () => {
    const { ports } = evalPorts({ stdout: ["out1", "out2"], stderr: ["warn1"] })

    const result = await evaluate(ports, { code: "1" })

    expect(result.stdout).toBe("out1\nout2")
    expect(result.stderr).toBe("warn1")
  })

  it("runs from repo root for workspace package resolution", async () => {
    const { ports, spawned } = evalPorts()

    await evaluate(ports, { code: "1" })

    expect(spawned[0]!.cwd).toBe("/repo")
  })
})
