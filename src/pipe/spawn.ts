import { type ChildProcess, spawn as nodeSpawn } from "node:child_process"
import { createInterface } from "node:readline"

import type { LogLineEvent } from "../logs/schema.ts"
import { parse } from "./parse.ts"
import type { PipeHandle, PipeResult, PipeSpawnOptions } from "./types.ts"

function resolveWidth(width?: number): number {
  if (width !== undefined) {
    return width
  }

  if (process.stdout.columns && process.stdout.columns > 0) {
    return process.stdout.columns
  }

  if (process.env.COLUMNS) {
    const parsed = Number.parseInt(process.env.COLUMNS, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }

  return 120
}

function createEvent(
  options: PipeSpawnOptions,
  lineNumber: number,
  stream: LogLineEvent["stream"],
  line: string,
): LogLineEvent | null {
  const parsed = parse(line)
  if (parsed === null) {
    return null
  }

  return {
    type: "line",
    timestamp: parsed.timestamp,
    session: options.session ?? options.source,
    section: options.section ?? null,
    source: options.source,
    stream,
    level: parsed.level,
    message: parsed.message,
    fields: parsed.fields,
    raw: parsed.raw,
    lineNumber,
  }
}

export function pipe(options: PipeSpawnOptions): PipeHandle {
  const width = resolveWidth(options.width)
  const listeners = new Set<(event: LogLineEvent) => void>()
  let lineNumber = 0

  const { NO_COLOR: _ignoredNoColor, ...cleanEnv } = process.env
  const cwd = options.cwd ?? process.cwd()
  const child: ChildProcess = nodeSpawn(options.cmd, options.args, {
    cwd,
    stdio: ["inherit", "pipe", "pipe"],
    env: {
      ...cleanEnv,
      COLUMNS: width.toString(),
      FORCE_COLOR: "1",
      LOG_FORMAT: "json",
      DEV_RUNNER: "1",
      ...options.env,
    },
  })

  options.sink?.onStart?.({
    source: options.source,
    cmd: options.cmd,
    args: options.args,
    cwd,
    session: options.session,
    section: options.section,
  })

  const notify = (event: LogLineEvent): void => {
    options.sink?.onEvent?.(event)
    options.onEvent?.(event)
    for (const listener of listeners) {
      listener(event)
    }
  }

  const handleLine = (stream: LogLineEvent["stream"], line: string): void => {
    lineNumber += 1
    const event = createEvent(options, lineNumber, stream, line)
    if (event !== null) {
      notify(event)
    }
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

  const exitPromise = new Promise<PipeResult>((resolve) => {
    let exitCode: number | null = null
    let signal: NodeJS.Signals | null = null

    child.on("exit", (code, nextSignal) => {
      exitCode = code
      signal = nextSignal
    })

    child.on("error", (error) => {
      const result: PipeResult = {
        exitCode: null,
        signal: null,
        error,
      }
      options.sink?.onFinish?.(result)
      options.onExit?.(result)
      resolve(result)
    })

    child.on("close", () => {
      const result: PipeResult = {
        exitCode,
        signal,
      }
      options.sink?.onFinish?.(result)
      options.onExit?.(result)
      resolve(result)
    })
  })

  const forwardSignal = (signal: NodeJS.Signals): void => {
    process.on(signal, () => {
      child.kill(signal)
    })
  }
  forwardSignal("SIGINT")
  forwardSignal("SIGTERM")

  return {
    child,
    stop: () => {
      child.kill("SIGTERM")
    },
    wait: () => exitPromise,
    onEvent(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export async function pipeAndWait(
  options: PipeSpawnOptions,
): Promise<PipeResult> {
  const handle = pipe(options)
  return handle.wait()
}
