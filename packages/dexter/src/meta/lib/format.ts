/**
 * Format flag parsing — extracts output mode from CLI args.
 *
 * Supports `--format cli|json|xml|md` and `--json` shorthand.
 * Format flags must appear before `--` separator.
 */

import type { OutputMode } from "../../output/types.ts"

const VALID_MODES = new Set<OutputMode>(["cli", "json", "xml", "md"])

export type ParsedFormat = {
  mode: OutputMode
  rest: string[]
}

/**
 * Extract format flag from args, return mode + remaining args.
 *
 * Scans only args before `--` separator. Default mode: `cli`.
 */
export function parseFormat(args: string[]): ParsedFormat {
  let mode: OutputMode = "cli"
  const rest: string[] = []
  const ddIndex = args.indexOf("--")
  const flagRegion = ddIndex >= 0 ? ddIndex : args.length

  for (let i = 0; i < args.length; i++) {
    if (i < flagRegion) {
      if (args[i] === "--json") {
        mode = "json"
        continue
      }
      if (args[i] === "--xml") {
        mode = "xml"
        continue
      }
      if (args[i] === "--md") {
        mode = "md"
        continue
      }
      if (args[i] === "--format" && i + 1 < flagRegion) {
        const candidate = args[i + 1] as OutputMode
        if (VALID_MODES.has(candidate)) {
          mode = candidate
          i++ // skip value
          continue
        }
      }
    }
    rest.push(args[i]!)
  }

  return { mode, rest }
}
