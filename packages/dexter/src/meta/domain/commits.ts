/**
 * Query: commits — recent commits for given scopes + repo-wide style reference.
 */

import type { ControlPorts } from "../ports.ts"
import type { CommitsScope, QueryResult } from "../types.ts"

export function commits(ports: ControlPorts, scopes: string[]): QueryResult {
  const data: CommitsScope[] = []

  for (const scope of scopes) {
    const logResult = ports.git.run(["log", "--oneline", "--format=%h %s (%an, %ar)", "-6", "--", scope])
    const lines = logResult.success && logResult.stdout ? logResult.stdout.split("\n").filter(Boolean) : []
    if (lines.length > 0) {
      data.push({ path: scope, log: lines })
    }
  }

  const log = ports.git.run(["log", "--oneline", "-5"])
  const recent = log.success ? log.stdout.split("\n").filter(Boolean) : []

  return { what: "commits", scopes, data, recent }
}
