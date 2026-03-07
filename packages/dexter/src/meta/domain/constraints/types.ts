/**
 * Constraint system types
 */

export type ConstraintResult = { ok: true } | { ok: false; message: string; hint?: string }

export interface Constraint<T = unknown> {
  name: string
  check: (input: T) => ConstraintResult
}

export interface PatternConstraint extends Constraint<string> {
  pattern: RegExp
  hint: string
}

/** Create a pattern-based constraint */
export function createPatternConstraint(name: string, pattern: RegExp, hint: string): PatternConstraint {
  return {
    name,
    pattern,
    hint,
    check: (input: string): ConstraintResult => {
      if (pattern.test(input)) {
        return { ok: false, message: `Pattern matched: ${name}`, hint }
      }
      return { ok: true }
    },
  }
}
