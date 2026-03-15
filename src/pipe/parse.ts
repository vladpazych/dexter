import { stripAnsi } from "../terminal/colors.ts"
import type { LogLevel } from "../logs/schema.ts"

export type ParsedLine = {
  level: LogLevel
  message: string
  fields: Record<string, unknown>
  timestamp: number
  raw: string
}

const PINO_LEVELS: Record<number, LogLevel> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
}

export function parseJson(line: string): ParsedLine | null {
  try {
    const data = JSON.parse(line) as Record<string, unknown>

    if (typeof data.level === "number") {
      return {
        level: PINO_LEVELS[data.level] ?? "info",
        message: typeof data.msg === "string" ? data.msg : "",
        fields: data,
        timestamp: typeof data.time === "number" ? data.time : Date.now(),
        raw: line,
      }
    }

    if (typeof data.level === "string") {
      const message =
        typeof data.msg === "string"
          ? data.msg
          : typeof data.message === "string"
            ? data.message
            : ""

      return {
        level: data.level as LogLevel,
        message,
        fields: data,
        timestamp:
          typeof data.time === "number"
            ? data.time
            : typeof data.timestamp === "number"
              ? data.timestamp
              : Date.now(),
        raw: line,
      }
    }

    return null
  } catch {
    return null
  }
}

function detectLevel(text: string): LogLevel {
  const lower = text.toLowerCase()

  if (
    lower.includes("error") ||
    lower.includes("failed") ||
    lower.includes("exception") ||
    lower.includes("eaddrinuse") ||
    lower.includes("enoent") ||
    lower.includes("eacces") ||
    text.startsWith("throw ") ||
    text.includes("Emitted 'error'")
  ) {
    return "error"
  }

  if (
    text.trimStart().startsWith("at ") ||
    text.includes("node:") ||
    (text.startsWith("    ") && text.includes("(")) ||
    /^\s*\^$/.test(text) ||
    /code: '/.test(text) ||
    /errno:/.test(text) ||
    /syscall:/.test(text) ||
    /address:/.test(text) ||
    /^\s*port:/.test(text) ||
    /^\s*\}$/.test(text)
  ) {
    return "error"
  }

  if (lower.includes("warn") || lower.includes("deprecat")) {
    return "warn"
  }

  if (lower.includes("debug")) {
    return "debug"
  }

  return "info"
}

export function parseRaw(line: string): ParsedLine | null {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }

  const cleaned = stripAnsi(trimmed)
  if (!cleaned) {
    return null
  }

  return {
    level: detectLevel(cleaned),
    message: trimmed,
    fields: {},
    timestamp: Date.now(),
    raw: line,
  }
}

export function parse(line: string): ParsedLine | null {
  return parseJson(line) ?? parseRaw(line)
}
