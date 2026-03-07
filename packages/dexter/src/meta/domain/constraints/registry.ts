/**
 * Constraint Registry — centralized constraint definitions.
 */

import { type ConstraintResult, type PatternConstraint, createPatternConstraint } from "./types.ts"

/** Git commands that should use workflow scripts */
export const GIT_WORKFLOW_CONSTRAINTS: PatternConstraint[] = [
  createPatternConstraint("git-add", /^git\s+(add)(\s|$)/, "Use ./scripts/git/commit"),
  createPatternConstraint("git-commit", /^git\s+(commit)(\s|$)/, "Use ./scripts/git/commit"),
]

/** Destructive git operations */
export const GIT_DESTRUCTIVE_CONSTRAINTS: PatternConstraint[] = [
  createPatternConstraint("git-force-push", /^git\s+push\s+.*--force/, "Force push not allowed. Use revert instead."),
  createPatternConstraint("git-hard-reset", /^git\s+reset\s+--hard/, "Hard reset not allowed. Use revert instead."),
  createPatternConstraint(
    "git-clean-force",
    /^git\s+clean\s+-f/,
    "git clean -f not allowed. Remove files explicitly.",
  ),
  createPatternConstraint(
    "git-checkout-all",
    /^git\s+checkout\s+\.$/,
    "Discard all changes not allowed. Be explicit about files.",
  ),
]

/** All bash command constraints */
export const BASH_CONSTRAINTS: PatternConstraint[] = [...GIT_WORKFLOW_CONSTRAINTS, ...GIT_DESTRUCTIVE_CONSTRAINTS]

/** Check a command against all bash constraints */
export function checkBashCommand(command: string): ConstraintResult {
  for (const constraint of BASH_CONSTRAINTS) {
    const result = constraint.check(command)
    if (!result.ok) {
      return result
    }
  }
  return { ok: true }
}

/** Check a command against pattern constraints, returning the first match */
export function findMatchingConstraint(
  command: string,
  constraints: PatternConstraint[],
): PatternConstraint | undefined {
  return constraints.find((c) => c.pattern.test(command))
}
