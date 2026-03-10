/**
 * Format flag parsing — extracts output mode from CLI args.
 *
 * Supports `--format cli|json`, `--format=cli|json`, and `--json`.
 * Format flags must appear before `--` separator.
 */

export type OutputMode = "cli" | "json"

const VALID_MODES = new Set<OutputMode>(["cli", "json"])

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
      if (args[i]?.startsWith("--format=")) {
        const candidate = args[i]!.slice("--format=".length) as OutputMode
        if (VALID_MODES.has(candidate)) {
          mode = candidate
          continue
        }
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
