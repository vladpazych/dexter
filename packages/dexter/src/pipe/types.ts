/**
 * Pipe module types.
 */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal"

export type LogEntry = {
  /** Log level */
  level: LogLevel
  /** Main message */
  message: string
  /** Structured fields (from JSON logs) */
  fields: Record<string, unknown>
  /** Unix timestamp ms */
  timestamp: number
  /** Original raw line */
  raw: string
}

export type PipedEntry = LogEntry & {
  /** Source identifier (e.g., "dimas-server") */
  source: string
  /** Log file path */
  logFile: string
  /** Line number in log file */
  lineNumber: number
}
