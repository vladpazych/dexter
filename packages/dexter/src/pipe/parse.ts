/**
 * Log line parsing.
 *
 * Handles both structured JSON (pino, etc.) and raw text output.
 */

import { stripAnsi } from "../terminal/colors.ts"
import type { LogEntry, LogLevel } from "./types.ts"

/** Pino numeric level to LogLevel */
const PINO_LEVELS: Record<number, LogLevel> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
}

/**
 * Parse a JSON log line (pino format).
 * Returns null if not valid JSON or missing required fields.
 */
export function parseJson(line: string): LogEntry | null {
  try {
    const data = JSON.parse(line) as Record<string, unknown>

    // Pino uses numeric levels
    if (typeof data.level === "number") {
      return {
        level: PINO_LEVELS[data.level] ?? "info",
        message: (data.msg as string) ?? "",
        fields: data,
        timestamp: (data.time as number) ?? Date.now(),
        raw: line,
      }
    }

    // String level (other loggers)
    if (typeof data.level === "string") {
      return {
        level: data.level as LogLevel,
        message: (data.msg as string) ?? (data.message as string) ?? "",
        fields: data,
        timestamp: (data.time as number) ?? (data.timestamp as number) ?? Date.now(),
        raw: line,
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Detect log level from raw text content.
 */
function detectLevel(text: string): LogLevel {
  const lower = text.toLowerCase()

  // Error patterns
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

  // Stack trace and error object patterns (continuation of error)
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

  // Warning patterns
  if (lower.includes("warn") || lower.includes("deprecat")) {
    return "warn"
  }

  if (lower.includes("debug")) {
    return "debug"
  }

  return "info"
}

/**
 * Parse a raw text line (non-JSON output).
 * Returns null for empty lines.
 * Preserves original ANSI codes in message for terminal passthrough.
 */
export function parseRaw(line: string): LogEntry | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Strip ANSI only for level detection, preserve original in message
  const cleaned = stripAnsi(trimmed)
  if (!cleaned) return null

  return {
    level: detectLevel(cleaned),
    message: trimmed, // Preserve original ANSI codes
    fields: {},
    timestamp: Date.now(),
    raw: line,
  }
}

/**
 * Parse any log line (JSON or raw).
 */
export function parse(line: string): LogEntry | null {
  return parseJson(line) ?? parseRaw(line)
}
