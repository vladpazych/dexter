/**
 * Check output parsing — extract structured error data from raw tool output.
 */

import type { CheckData, CheckError } from "../types.ts"

/**
 * Detect lines that represent errors in check output.
 */
export function isErrorLine(line: string): boolean {
  if (/[:(]\d+[,):]/.test(line) && /error/i.test(line)) return true
  if (line.includes("\u2717") || line.includes("FAIL")) return true
  return false
}

/**
 * Extract structured error entries from raw check output.
 */
export function extractErrors(raw: string): CheckData {
  if (!raw.trim()) {
    return { errorCount: 0, errors: [], raw }
  }

  const lines = raw.split("\n")
  const errors: CheckError[] = lines
    .map((line, idx) => ({ line: idx + 1, summary: line }))
    .filter(({ summary }) => isErrorLine(summary))
    .map(({ line, summary }) => ({
      line,
      summary: summary.length > 80 ? summary.slice(0, 77) + "..." : summary,
    }))

  return { errorCount: errors.length, errors, raw }
}
