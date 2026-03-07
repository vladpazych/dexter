/**
 * Query: diff — git status and diff for given scopes.
 */

import type { ControlPorts } from "../ports.ts"
import type { DiffScope, QueryResult } from "../types.ts"

const DIFF_LINE_LIMIT = 200

export function diff(ports: ControlPorts, scopes: string[]): QueryResult {
  const data: DiffScope[] = []

  for (const scope of scopes) {
    const statusResult = ports.git.run(["status", "--short", "--", scope])
    const status = statusResult.success ? statusResult.stdout.trim() : ""

    const diffResult = ports.git.run(["diff", "HEAD", "--", scope])
    let diffText = ""
    if (diffResult.success && diffResult.stdout) {
      const lines = diffResult.stdout.split("\n")
      if (lines.length > DIFF_LINE_LIMIT) {
        diffText = lines.slice(0, DIFF_LINE_LIMIT).join("\n") + `\n... (${lines.length - DIFF_LINE_LIMIT} more lines)`
      } else {
        diffText = diffResult.stdout
      }
    }

    if (status || diffText.trim()) {
      data.push({ path: scope, status, diff: diffText.trim() })
    }
  }

  return { what: "diff", scopes, data }
}
