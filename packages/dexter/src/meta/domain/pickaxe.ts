/**
 * Git pickaxe — find commits that added or removed a pattern.
 */

import type { ControlPorts } from "../ports.ts"
import type { GitResult, PickaxeMatch } from "../types.ts"
import { ControlError } from "../errors.ts"

const MAX_MATCHES = 10

/** Parse git log output with custom format + patch into PickaxeMatch[]. */
function parseLogOutput(raw: string): PickaxeMatch[] {
  if (!raw.trim()) return []

  const matches: PickaxeMatch[] = []
  const commits = raw.split(/^(?=commit [0-9a-f]{40}$)/m).filter(Boolean)

  for (const block of commits) {
    const lines = block.split("\n")
    let hash = ""
    let author = ""
    let date = ""
    let message = ""
    const diffLines: string[] = []
    let inDiff = false

    for (const line of lines) {
      if (line.startsWith("commit ")) {
        hash = line.slice(7, 15)
      } else if (line.startsWith("Author: ")) {
        const authorMatch = line.match(/^Author:\s+(.+?)\s*</)
        author = authorMatch ? authorMatch[1]!.trim() : line.slice(8).trim()
      } else if (line.startsWith("Date: ")) {
        const raw = line.slice(6).trim()
        try {
          date = new Date(raw).toISOString().slice(0, 10)
        } catch {
          date = raw
        }
      } else if (line.startsWith("    ") && !inDiff && !message) {
        message = line.trim()
      } else if (line.startsWith("diff --git") || inDiff) {
        inDiff = true
        diffLines.push(line)
      }
    }

    if (hash) {
      matches.push({
        hash,
        author,
        date,
        message,
        diff: diffLines.join("\n").trim(),
      })
    }
  }

  return matches
}

export function pickaxe(
  ports: ControlPorts,
  pattern: string,
  opts?: { regex?: boolean; scopes?: string[] },
): GitResult {
  if (!pattern) {
    throw new ControlError("empty_pattern", "pickaxe requires a search pattern", [
      "Usage: pickaxe <pattern> [--regex] [scopes...]",
    ])
  }

  const args = ["log"]

  if (opts?.regex) {
    args.push("-G", pattern)
  } else {
    args.push("-S", pattern)
  }

  args.push(`-${MAX_MATCHES}`, "--patch", "--diff-filter=AMD")

  if (opts?.scopes && opts.scopes.length > 0) {
    args.push("--", ...opts.scopes)
  }

  const result = ports.git.run(args)
  if (!result.success) {
    throw new ControlError(
      "pickaxe_failed",
      `git log pickaxe failed: ${result.stderr.trim()}`,
      [opts?.regex ? "Check that the regex pattern is valid" : "", "Ensure the repository has commits"].filter(Boolean),
    )
  }

  const matches = parseLogOutput(result.stdout)

  return { what: "pickaxe", pattern, matches }
}
