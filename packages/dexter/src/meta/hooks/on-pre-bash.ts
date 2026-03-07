import { readJsonStdin, getCommand, type HookInput } from "../lib/stdin.ts"

/** Patterns to deny with hints */
const DENY_PATTERNS = [
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

export async function onPreBash(): Promise<void> {
  const input = await readJsonStdin<HookInput>()
  const command = getCommand(input)

  if (!command) {
    process.exit(0)
  }

  for (const { pattern, hint } of DENY_PATTERNS) {
    if (pattern.test(command)) {
      if (await isInConflictResolution()) {
        process.exit(0)
      }

      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: `Raw git command blocked: ${command}. ${hint}`,
          },
        }),
      )
      process.exit(0)
    }
  }

  process.exit(0)
}
