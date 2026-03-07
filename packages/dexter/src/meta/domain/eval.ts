/**
 * Eval domain logic — execute TypeScript code in a sandboxed subprocess.
 */

import { join } from "node:path"

import { ControlError } from "../errors.ts"
import type { ControlPorts } from "../ports.ts"
import type { EvalParams, EvalResult } from "../types.ts"

const SCRATCH_DIR = "meta/.scratch"
const DEFAULT_TIMEOUT = 5000

export async function evaluate(ports: ControlPorts, params: EvalParams): Promise<EvalResult> {
  const { code, timeout = DEFAULT_TIMEOUT } = params

  if (!code.trim()) {
    throw new ControlError("empty_code", "no code to evaluate", ["provide a TypeScript expression or snippet"])
  }

  const scratchPath = join(ports.root, SCRATCH_DIR)
  if (!ports.fs.exists(scratchPath)) {
    ports.fs.mkdir(scratchPath)
  }

  const filename = `eval-${process.pid}-${Date.now()}.ts`
  const filepath = join(scratchPath, filename)

  try {
    ports.fs.writeFile(filepath, code)

    const stdout: string[] = []
    const stderr: string[] = []

    const handle = ports.process.spawn({
      cmd: "bun",
      args: ["run", filepath],
      cwd: ports.root,
      timeout,
    })

    handle.onLine("stdout", (line) => stdout.push(line))
    handle.onLine("stderr", (line) => stderr.push(line))

    const exitCode = await handle.wait()

    return {
      ok: exitCode === 0,
      stdout: stdout.join("\n"),
      stderr: stderr.join("\n"),
    }
  } finally {
    if (ports.fs.exists(filepath)) {
      ports.fs.unlink(filepath)
    }
  }
}
