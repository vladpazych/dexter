/**
 * Process spawning with output capture and routing.
 *
 * Spawns a child process, captures stdout/stderr, parses each line,
 * and routes to file and terminal with appropriate formatting.
 */

import { type ChildProcess, spawn as nodeSpawn } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { createInterface } from "node:readline"
import { setColorEnabled } from "../terminal/colors.ts"
import { formatFile, formatTerminal } from "./format.ts"
import { parse } from "./parse.ts"
import type { PipedEntry } from "./types.ts"

/**
 * Find monorepo root by looking for package.json with workspaces.
 * Falls back to start directory.
 */
function findMonorepoRoot(startDir: string): string {
  let dir = startDir
  while (dir !== dirname(dir)) {
    const pkgPath = join(dir, "package.json")
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
        if (pkg.workspaces) {
          return dir
        }
      } catch {
        // Invalid JSON, continue searching
      }
    }
    dir = dirname(dir)
  }
  return startDir
}

export type PipeOptions = {
  /** Short name for display and log file (e.g., "api", "web") */
  name: string
  /** Command to run */
  cmd: string
  /** Command arguments */
  args: string[]
  /** Working directory */
  cwd?: string
  /**
   * Log file path. Defaults to `.logs/{name}.log` in monorepo root.
   * If relative, resolved from cwd.
   */
  logFile?: string
  /** Terminal width for truncation (auto-detected if not specified) */
  width?: number
  /** Additional environment variables */
  env?: Record<string, string>
  /** Callback for each parsed log entry */
  onLog?: (entry: PipedEntry) => void
  /** Callback on process exit */
  onExit?: (code: number | null) => void
}

export type PipeHandle = {
  /** The spawned child process */
  child: ChildProcess
  /** Send SIGTERM to the process */
  stop: () => void
  /** Promise that resolves when process exits */
  wait: () => Promise<number | null>
}

/**
 * Spawn a process with output piping.
 *
 * - Captures stdout/stderr line by line
 * - Parses each line (JSON or raw)
 * - Writes full content to log file
 * - Writes truncated colored output to terminal
 */
export function pipe(options: PipeOptions): PipeHandle {
  // Enable colors for dexter output (override NO_COLOR from parent shell)
  setColorEnabled(true)

  const cwd = options.cwd ?? process.cwd()
  const monorepoRoot = findMonorepoRoot(cwd)

  // Default log file: {name}.log in monorepo root
  const logFile = options.logFile ?? join(monorepoRoot, `${options.name}.log`)
  const logFilePath = logFile.startsWith("/") ? logFile : resolve(cwd, logFile)

  // Display name is just the short name (e.g., "api", "web")
  const displayName = options.name

  // Ensure directory exists and truncate file
  try {
    mkdirSync(dirname(logFilePath), { recursive: true })
  } catch {
    // dir exists
  }
  writeFileSync(logFilePath, "")

  let lineNumber = 0

  // Remove NO_COLOR to avoid conflict with our color handling
  const { NO_COLOR: _, ...cleanEnv } = process.env

  // Get terminal width for output truncation
  // Priority: explicit option > stdout.columns > COLUMNS env > default
  let terminalWidth = options.width
  if (!terminalWidth) {
    if (process.stdout.columns && process.stdout.columns > 0) {
      terminalWidth = process.stdout.columns
    } else if (process.env.COLUMNS) {
      terminalWidth = parseInt(process.env.COLUMNS, 10) || 120
    } else {
      terminalWidth = 120
    }
  }

  const child = nodeSpawn(options.cmd, options.args, {
    cwd,
    stdio: ["inherit", "pipe", "pipe"],
    env: {
      ...cleanEnv,
      // Pass terminal width to child for proper truncation
      COLUMNS: String(terminalWidth),
      // Enable colors in child processes (vite, etc.)
      FORCE_COLOR: "1",
      // Enable colors in dexter's output
      DEXTER_COLOR: "1",
      ...options.env,
      // Signal to apps: output JSON for parsing, don't write own files
      LOG_FORMAT: "json",
      DEV_RUNNER: "1",
    },
  })

  const handleLine = (line: string) => {
    const parsed = parse(line)
    if (!parsed) return

    lineNumber++

    const entry: PipedEntry = {
      ...parsed,
      source: options.name,
      logFile: displayName,
      lineNumber,
    }

    // Write to file (full content, source of truth)
    const fileLine = formatFile(entry)
    appendFileSync(logFilePath, `${fileLine}\n`)

    // Write to terminal (truncated, colored)
    const terminalLine = formatTerminal(entry, { width: terminalWidth })
    process.stdout.write(`${terminalLine}\n`)

    // Callback
    options.onLog?.(entry)
  }

  // Capture stdout
  if (child.stdout) {
    const rl = createInterface({ input: child.stdout })
    rl.on("line", handleLine)
  }

  // Capture stderr
  if (child.stderr) {
    const rl = createInterface({ input: child.stderr })
    rl.on("line", handleLine)
  }

  // Exit handling
  const exitPromise = new Promise<number | null>((resolve) => {
    child.on("exit", (code) => {
      options.onExit?.(code)
      resolve(code)
    })
  })

  // Forward signals
  const forwardSignal = (signal: NodeJS.Signals) => {
    process.on(signal, () => child.kill(signal))
  }
  forwardSignal("SIGINT")
  forwardSignal("SIGTERM")

  return {
    child,
    stop: () => child.kill("SIGTERM"),
    wait: () => exitPromise,
  }
}

/**
 * Spawn and wait for exit (convenience wrapper).
 */
export async function pipeAndWait(options: PipeOptions): Promise<number> {
  const handle = pipe(options)
  const code = await handle.wait()
  return code ?? 0
}
