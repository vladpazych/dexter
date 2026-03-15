import type { ChildProcess } from "node:child_process"

import type { LogLineEvent } from "../logs/schema.ts"

export type PipeStart = {
  source: string
  cmd: string
  args: string[]
  cwd: string
  session?: string
  section?: string
}

export type PipeSink = {
  onStart?: (start: PipeStart) => void
  onEvent?: (event: LogLineEvent) => void
  onFinish?: (result: PipeResult) => void
}

export type PipeSpawnOptions = {
  source: string
  cmd: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
  width?: number
  session?: string
  section?: string
  sink?: PipeSink
  onEvent?: (event: LogLineEvent) => void
  onExit?: (result: PipeResult) => void
}

export type PipeResult = {
  exitCode: number | null
  signal: NodeJS.Signals | null
  error?: Error
}

export type PipeHandle = {
  child: ChildProcess
  stop: () => void
  wait: () => Promise<PipeResult>
  onEvent: (listener: (event: LogLineEvent) => void) => () => void
}
