/**
 * Log formatting for terminal and file output.
 */

import { bold, dim, gray, red, reset, yellow } from "../terminal/colors.ts"
import type { LogLevel, PipedEntry } from "./types.ts"

/**
 * Get terminal width from multiple sources.
 * Priority: COLUMNS env > stdout.columns > 120
 */
function getTerminalWidth(): number {
  // COLUMNS env var (set by shell or parent)
  const envColumns = process.env.COLUMNS
  if (envColumns) {
    const parsed = parseInt(envColumns, 10)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }

  // stdout.columns (works when TTY)
  if (process.stdout.columns && process.stdout.columns > 0) {
    return process.stdout.columns
  }

  // Default fallback
  return 120
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  trace: "T",
  debug: "D",
  info: "I",
  warn: "W",
  error: "E",
  fatal: "F",
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: gray,
  debug: dim,
  info: "",
  warn: yellow,
  error: red,
  fatal: bold + red,
}

/** Fields to exclude from key=value output */
const SUPPRESSED = new Set(["level", "time", "pid", "hostname", "name", "msg", "message", "v", "timestamp"])

/**
 * Format fields as key=value pairs.
 * @param fields - Log fields
 * @param maxValueLen - Max length per value (truncate with ...)
 */
function formatFields(fields: Record<string, unknown>, maxValueLen = 20): string {
  const pairs: string[] = []

  for (const [key, value] of Object.entries(fields)) {
    if (SUPPRESSED.has(key) || value === undefined) continue

    let strValue = typeof value === "string" ? value : JSON.stringify(value)
    if (strValue.length > maxValueLen) {
      strValue = `${strValue.slice(0, maxValueLen - 1)}…`
    }
    pairs.push(`${key}=${strValue}`)
  }

  return pairs.join(" ")
}

/**
 * Format file:line prefix with fixed-width line number.
 */
function formatPrefix(logFile: string, lineNumber: number): string {
  const line = lineNumber.toString().padEnd(5, " ")
  return `${logFile}:${line}`
}

export type FormatTerminalOptions = {
  /** Terminal width for truncation */
  width?: number
  /** Max width per field value */
  maxValueLen?: number
}

/**
 * Strip ANSI escape codes for length calculation.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ANSI pattern
const ANSI_REGEX = /\x1b\[[0-9;]*m/g
function stripAnsiLocal(str: string): string {
  return str.replace(ANSI_REGEX, "")
}

/**
 * Format log entry for terminal output.
 *
 * Format: "L file:line  message kv..."
 * - Level character is colored
 * - Message preserves original ANSI codes (e.g., vite colors)
 * - Truncated to terminal width
 * - file:line is clickable in most terminals
 */
export function formatTerminal(entry: PipedEntry, options: FormatTerminalOptions = {}): string {
  const { width = getTerminalWidth(), maxValueLen = 20 } = options

  const label = LEVEL_LABELS[entry.level]
  const levelColor = LEVEL_COLORS[entry.level]
  const prefix = formatPrefix(entry.logFile, entry.lineNumber)
  const kv = formatFields(entry.fields, maxValueLen)

  let message = entry.message
  let kvPart = kv ? ` ${kv}` : ""

  // Calculate visible length (without ANSI codes)
  const messagePlain = stripAnsiLocal(message)

  // Fixed parts: "L " + prefix + " "
  const fixedWidth = 2 + prefix.length + 1
  const available = width - fixedWidth

  if (available > 0) {
    const total = messagePlain.length + kvPart.length

    if (total > available) {
      // Truncate kv first, then message
      if (kvPart.length > 0 && messagePlain.length < available - 3) {
        const kvMax = available - messagePlain.length - 4
        kvPart = kvMax > 0 ? ` ${kv.slice(0, kvMax)}…` : ""
      } else {
        kvPart = ""
        if (messagePlain.length > available - 1) {
          // Truncate message (approximate - may cut mid-ANSI sequence)
          const truncLen = available - 2
          if (truncLen > 0 && truncLen < messagePlain.length) {
            // Simple truncation for messages with ANSI - preserve some content
            message = `${message.slice(0, truncLen + (message.length - messagePlain.length))}${reset}…`
          }
        }
      }
    }
  }

  // Color only the level character, preserve message colors
  // Dim the file:line prefix for reduced visual noise
  const coloredLabel = levelColor ? `${levelColor}${label}${reset}` : label
  const dimmedPrefix = `${dim}${prefix}${reset}`
  return `${coloredLabel} ${dimmedPrefix} ${message}${kvPart}`
}

/**
 * Format log entry for file output.
 *
 * Format: "L HH:MM:SS message kv..."
 * - No colors (ANSI stripped)
 * - No truncation (full content)
 * - No file:line (the file IS the source)
 */
export function formatFile(entry: PipedEntry): string {
  const label = LEVEL_LABELS[entry.level]
  const time = new Date(entry.timestamp).toISOString().slice(11, 19)
  const kv = formatFields(entry.fields, 1000) // No truncation
  const message = stripAnsiLocal(entry.message) // Strip ANSI for file

  const kvPart = kv ? ` ${kv}` : ""
  return `${label} ${time} ${message}${kvPart}`
}
