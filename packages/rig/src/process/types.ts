import type { ChildProcess } from "node:child_process"

export type ProcessStart = {
  cmd: string
  args: string[]
  cwd: string
}

export type ProcessLine = {
  stream: "stdout" | "stderr"
  line: string
  lineNumber: number
}

export type ProcessSink = {
  onStart?: (start: ProcessStart) => void
  onLine?: (line: ProcessLine) => void
  onFinish?: (result: ProcessResult) => void
}

export type ProcessSpawnOptions = {
  cmd: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
  stdin?: string
  sink?: ProcessSink
  onLine?: (line: ProcessLine) => void
  onExit?: (result: ProcessResult) => void
}

export type ProcessResult = {
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  error?: Error
}

export type ProcessHandle = {
  child: ChildProcess
  stop: (signal?: NodeJS.Signals) => void
  wait: () => Promise<ProcessResult>
  onLine: (listener: (line: ProcessLine) => void) => () => void
}
