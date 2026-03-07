import { getCommand, type HookInput } from "../lib/stdin.ts"

export type DenyPattern = { pattern: RegExp; hint: string }

/** Core deny patterns — always active */
export const CORE_DENY_PATTERNS: DenyPattern[] = [
  { pattern: /^git\s+(add)(\s|$)/, hint: "Use: /commit skill" },
  { pattern: /^git\s+commit(?!\s+--no-verify)(\s|$)/, hint: "Use: /commit skill" },
  { pattern: /^git\s+push\s+.*--force/, hint: "Force push not allowed. Use revert instead." },
  { pattern: /^git\s+reset\s+--hard/, hint: "Hard reset not allowed. Use revert instead." },
  { pattern: /^git\s+clean\s+-f/, hint: "git clean -f not allowed. Remove files explicitly." },
  { pattern: /^git\s+checkout\s+\.$/, hint: "Discard all changes not allowed. Be explicit about files." },
]

async function isInConflictResolution(): Promise<boolean> {
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--git-dir"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    if (!result.success) return false
    const gitDir = result.stdout.toString().trim()

    const conflictIndicators = [
      `${gitDir}/rebase-merge`,
      `${gitDir}/rebase-apply`,
      `${gitDir}/MERGE_HEAD`,
      `${gitDir}/CHERRY_PICK_HEAD`,
    ]

    for (const indicator of conflictIndicators) {
      if (await Bun.file(indicator).exists()) {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

/** Check command against deny patterns. Returns deny reason or null (allow). */
export async function checkPreBash(
  input: HookInput | null,
  patterns: DenyPattern[],
): Promise<string | null> {
  const command = getCommand(input)
  if (!command) return null

  for (const { pattern, hint } of patterns) {
    if (pattern.test(command)) {
      if (await isInConflictResolution()) return null
      return `Raw git command blocked: ${command}. ${hint}`
    }
  }

  return null
}
