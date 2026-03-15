import { createColors, stripAnsi } from "../terminal/colors.ts"
import type {
  LogLineEvent,
  LogStatus,
  SectionEndEvent,
  SectionStartEvent,
} from "./schema.ts"

export type LogRenderOptions = {
  color?: boolean
  width?: number
}

export type LogSummary = {
  name: string
  status: LogStatus
  durationMs: number
  sections: number
}

const LEVEL_LABELS: Record<LogLineEvent["level"], string> = {
  trace: "T",
  debug: "D",
  info: "I",
  warn: "W",
  error: "E",
  fatal: "F",
}

const STATUS_LABELS: Record<LogStatus, string> = {
  running: "RUN",
  passed: "OK",
  failed: "FAIL",
  cancelled: "CANCEL",
}

const SUPPRESSED_FIELDS = new Set([
  "level",
  "time",
  "pid",
  "hostname",
  "name",
  "msg",
  "message",
  "v",
  "timestamp",
])

function getWidth(width?: number): number {
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

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`
  }

  return `${(durationMs / 1000).toFixed(1)}s`
}

function formatFields(
  fields: Record<string, unknown>,
  maxValueLen = 24,
): string {
  const pairs: string[] = []

  for (const [key, value] of Object.entries(fields)) {
    if (SUPPRESSED_FIELDS.has(key) || value === undefined) {
      continue
    }

    const raw = typeof value === "string" ? value : JSON.stringify(value)
    if (raw === undefined) {
      continue
    }

    const formatted =
      raw.length > maxValueLen ? `${raw.slice(0, maxValueLen - 1)}...` : raw
    pairs.push(`${key}=${formatted}`)
  }

  return pairs.join(" ")
}

function formatStatus(status: LogStatus, color?: boolean): string {
  const colors = createColors({ color })
  const label = STATUS_LABELS[status]

  switch (status) {
    case "passed":
      return colors.green(label)
    case "failed":
      return colors.red(label)
    case "cancelled":
      return colors.yellow(label)
    case "running":
      return colors.blue(label)
  }
}

function truncate(text: string, width: number): string {
  if (width <= 0) {
    return text
  }

  const plain = stripAnsi(text)
  if (plain.length <= width) {
    return text
  }

  return `${plain.slice(0, Math.max(0, width - 3))}...`
}

export function renderLogLine(
  event: LogLineEvent,
  options: LogRenderOptions = {},
): string {
  const colors = createColors({ color: options.color })
  const width = getWidth(options.width)
  const label = LEVEL_LABELS[event.level]
  const scope =
    event.section === null
      ? event.source
      : event.source === event.section
        ? event.section
        : `${event.section}/${event.source}`
  const prefix = `${scope}:${event.lineNumber}`
  const kv = formatFields(event.fields)
  const message = kv ? `${event.message} ${kv}` : event.message

  let formattedLabel = label
  switch (event.level) {
    case "trace":
      formattedLabel = colors.gray(label)
      break
    case "debug":
      formattedLabel = colors.dim(label)
      break
    case "warn":
      formattedLabel = colors.yellow(label)
      break
    case "error":
      formattedLabel = colors.red(label)
      break
    case "fatal":
      formattedLabel = colors.bold(colors.red(label))
      break
    case "info":
      break
  }

  return truncate(`${formattedLabel} ${colors.dim(prefix)} ${message}`, width)
}

export function renderLogSection(
  event: SectionStartEvent | SectionEndEvent,
  options: LogRenderOptions = {},
): string {
  const colors = createColors({ color: options.color })

  if (event.type === "section:start") {
    return `${colors.bold(">")} ${event.section}`
  }

  const status = formatStatus(event.status, options.color)
  const exit =
    event.exitCode === null ? "" : ` exit=${event.exitCode.toString()}`
  return `${colors.bold("<")} ${event.section} ${status} ${formatDuration(
    event.durationMs,
  )}${exit}`
}

export function renderLogSummary(
  summary: LogSummary,
  options: LogRenderOptions = {},
): string {
  const colors = createColors({ color: options.color })
  const status = formatStatus(summary.status, options.color)
  return [
    colors.bold("session"),
    summary.name,
    status,
    formatDuration(summary.durationMs),
    `${summary.sections.toString()} sections`,
  ].join(" ")
}
