import { appendFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { Writable } from "node:stream"

import {
  terminal,
  type LogEvent,
  type LogLevel,
  type LogSink,
} from "@vladpazych/rig"

export type SinkFormat = "pretty" | "json"

export type LogFormatter = (event: LogEvent) => string

type SinkOptions = {
  level?: LogLevel
  format?: SinkFormat
  formatter?: LogFormatter
  lineEnding?: string
}

export type StreamSinkOptions = SinkOptions & {
  stream: Writable
}

export type ConsoleSinkOptions = SinkOptions & {
  stdout?: Writable
  stderr?: Writable
  color?: boolean
}

export type FileSinkOptions = SinkOptions & {
  path: string
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
}

function shouldWrite(activeLevel: LogLevel, level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[activeLevel]
}

function formatFieldValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value)
  }

  return JSON.stringify(value)
}

function formatFields(fields: Record<string, unknown>): string {
  const parts = Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${formatFieldValue(value)}`)

  return parts.join(" ")
}

function createPrettyFormatter(color = false): LogFormatter {
  const colors = terminal.with({ color }).colors

  const colorLevel = (level: LogLevel): string => {
    const label = level.toUpperCase()

    switch (level) {
      case "trace":
        return colors.gray(label)
      case "debug":
        return colors.blue(label)
      case "info":
        return colors.green(label)
      case "warn":
        return colors.yellow(label)
      case "error":
        return colors.red(label)
      case "fatal":
        return colors.bold(colors.red(label))
    }
  }

  return (event) => {
    const timestamp = new Date(event.timestamp).toISOString()
    const loggerName =
      event.logger === null ? "" : ` ${colors.cyan(`[${event.logger}]`)}`
    const fieldText = formatFields(event.fields)
    const suffix = fieldText.length === 0 ? "" : ` ${fieldText}`

    return `${colors.gray(timestamp)} ${colorLevel(event.level)}${loggerName} ${event.message}${suffix}`
  }
}

type TtyWritable = Writable & {
  isTTY?: boolean
}

function formatJson(event: LogEvent): string {
  return JSON.stringify(event)
}

function resolveFormatter(
  options: SinkOptions,
  prettyColor = false,
): LogFormatter {
  if (options.formatter !== undefined) {
    return options.formatter
  }

  if (options.format === "json") {
    return formatJson
  }

  return createPrettyFormatter(prettyColor)
}

function resolveLineEnding(options: SinkOptions): string {
  return options.lineEnding ?? "\n"
}

function resolveLevel(level: LogLevel | undefined): LogLevel {
  return level ?? "trace"
}

function resolveConsoleColor(
  override: boolean | undefined,
  stream: TtyWritable,
): boolean {
  if (override !== undefined) {
    return override
  }

  if (process.env.NO_COLOR && process.env.NO_COLOR !== "0") {
    return false
  }

  if (process.env.FORCE_COLOR === "1") {
    return true
  }

  return stream.isTTY === true
}

export function streamSink(options: StreamSinkOptions): LogSink {
  const level = resolveLevel(options.level)
  const formatter = resolveFormatter(options)
  const lineEnding = resolveLineEnding(options)

  return {
    write(event) {
      if (!shouldWrite(level, event.level)) {
        return
      }

      options.stream.write(`${formatter(event)}${lineEnding}`)
    },
  }
}

export function consoleSink(options: ConsoleSinkOptions = {}): LogSink {
  const stdout = (options.stdout ?? process.stdout) as TtyWritable
  const stderr = (options.stderr ?? process.stderr) as TtyWritable
  const level = resolveLevel(options.level)
  const stdoutFormatter = resolveFormatter(
    options,
    resolveConsoleColor(options.color, stdout),
  )
  const stderrFormatter = resolveFormatter(
    options,
    resolveConsoleColor(options.color, stderr),
  )
  const lineEnding = resolveLineEnding(options)

  return {
    write(event) {
      if (!shouldWrite(level, event.level)) {
        return
      }

      const stream =
        event.level === "warn" ||
        event.level === "error" ||
        event.level === "fatal"
          ? stderr
          : stdout
      const formatter = stream === stderr ? stderrFormatter : stdoutFormatter

      stream.write(`${formatter(event)}${lineEnding}`)
    },
  }
}

export function fileSink(options: FileSinkOptions): LogSink {
  const level = resolveLevel(options.level)
  const formatter = resolveFormatter(options, false)
  const lineEnding = resolveLineEnding(options)

  return {
    write(event) {
      if (!shouldWrite(level, event.level)) {
        return
      }

      mkdirSync(dirname(options.path), { recursive: true })
      appendFileSync(options.path, `${formatter(event)}${lineEnding}`)
    },
  }
}
