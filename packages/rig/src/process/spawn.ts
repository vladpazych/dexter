import { type ChildProcess, spawn as nodeSpawn } from "node:child_process"
import { createInterface } from "node:readline"

import type {
  ProcessHandle,
  ProcessLine,
  ProcessResult,
  ProcessSpawnOptions,
} from "./types.js"

export function spawnProcess(options: ProcessSpawnOptions): ProcessHandle {
  const listeners = new Set<(line: ProcessLine) => void>()
  const stdoutLines: string[] = []
  const stderrLines: string[] = []
  let lineNumber = 0

  const cwd = options.cwd ?? process.cwd()
  const child: ChildProcess = nodeSpawn(options.cmd, options.args, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      ...options.env,
    },
  })

  if (child.stdin !== null) {
    if (options.stdin !== undefined) {
      child.stdin.end(options.stdin)
    } else {
      child.stdin.end()
    }
  }

  options.sink?.onStart?.({
    cmd: options.cmd,
    args: options.args,
    cwd,
  })

  const notify = (line: ProcessLine): void => {
    options.sink?.onLine?.(line)
    options.onLine?.(line)

    for (const listener of listeners) {
      listener(line)
    }
  }

  const handleLine = (stream: ProcessLine["stream"], line: string): void => {
    lineNumber += 1

    if (stream === "stdout") {
      stdoutLines.push(line)
    } else {
      stderrLines.push(line)
    }

    notify({
      stream,
      line,
      lineNumber,
    })
  }

  if (child.stdout !== null) {
    const stdout = createInterface({ input: child.stdout })
    stdout.on("line", (line) => {
      handleLine("stdout", line)
    })
  }

  if (child.stderr !== null) {
    const stderr = createInterface({ input: child.stderr })
    stderr.on("line", (line) => {
      handleLine("stderr", line)
    })
  }

  const exitPromise = new Promise<ProcessResult>((resolve) => {
    let settled = false
    let exitCode: number | null = null
    let signal: NodeJS.Signals | null = null

    const handleSigint = (): void => {
      child.kill("SIGINT")
    }
    const handleSigterm = (): void => {
      child.kill("SIGTERM")
    }

    const cleanupSignalListeners = (): void => {
      process.off("SIGINT", handleSigint)
      process.off("SIGTERM", handleSigterm)
    }

    const finish = (result: ProcessResult): void => {
      if (settled) {
        return
      }

      settled = true
      cleanupSignalListeners()
      options.sink?.onFinish?.(result)
      options.onExit?.(result)
      resolve(result)
    }

    process.on("SIGINT", handleSigint)
    process.on("SIGTERM", handleSigterm)

    child.on("exit", (code, nextSignal) => {
      exitCode = code
      signal = nextSignal
    })

    child.on("error", (error) => {
      finish({
        exitCode: null,
        signal: null,
        stdout: stdoutLines.join("\n"),
        stderr: stderrLines.join("\n"),
        error,
      })
    })

    child.on("close", () => {
      finish({
        exitCode,
        signal,
        stdout: stdoutLines.join("\n"),
        stderr: stderrLines.join("\n"),
      })
    })
  })

  return {
    child,
    stop: (signal = "SIGTERM") => {
      child.kill(signal)
    },
    wait: () => exitPromise,
    onLine(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export async function runProcess(
  options: ProcessSpawnOptions,
): Promise<ProcessResult> {
  const handle = spawnProcess(options)
  return handle.wait()
}
