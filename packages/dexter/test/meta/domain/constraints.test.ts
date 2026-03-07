/**
 * Constraint System Tests
 *
 * Pure functions — no ports, no async.
 */

import { describe, expect, it } from "bun:test"

import { createPatternConstraint } from "../../../src/meta/domain/constraints/types.ts"
import {
  BASH_CONSTRAINTS,
  GIT_DESTRUCTIVE_CONSTRAINTS,
  GIT_WORKFLOW_CONSTRAINTS,
  checkBashCommand,
  findMatchingConstraint,
} from "../../../src/meta/domain/constraints/registry.ts"

describe("createPatternConstraint", () => {
  const constraint = createPatternConstraint("test-rule", /^danger/, "Do not use danger")

  it("returns ok when pattern does not match", () => {
    const result = constraint.check("safe command")
    expect(result).toEqual({ ok: true })
  })

  it("returns not-ok with message when pattern matches", () => {
    const result = constraint.check("danger zone")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain("test-rule")
    }
  })

  it("includes hint in failed result", () => {
    const result = constraint.check("danger zone")
    if (!result.ok) {
      expect(result.hint).toBe("Do not use danger")
    }
  })

  it("exposes pattern and hint on the constraint", () => {
    expect(constraint.pattern).toEqual(/^danger/)
    expect(constraint.hint).toBe("Do not use danger")
    expect(constraint.name).toBe("test-rule")
  })
})

describe("GIT_WORKFLOW_CONSTRAINTS", () => {
  it("blocks git add", () => {
    const match = findMatchingConstraint("git add .", GIT_WORKFLOW_CONSTRAINTS)
    expect(match).toBeDefined()
    expect(match!.name).toBe("git-add")
  })

  it("blocks bare git add", () => {
    const match = findMatchingConstraint("git add", GIT_WORKFLOW_CONSTRAINTS)
    expect(match).toBeDefined()
  })

  it("blocks git commit", () => {
    const match = findMatchingConstraint("git commit -m 'msg'", GIT_WORKFLOW_CONSTRAINTS)
    expect(match).toBeDefined()
    expect(match!.name).toBe("git-commit")
  })

  it("does not block git status", () => {
    const match = findMatchingConstraint("git status", GIT_WORKFLOW_CONSTRAINTS)
    expect(match).toBeUndefined()
  })

  it("does not block git log", () => {
    const match = findMatchingConstraint("git log --oneline", GIT_WORKFLOW_CONSTRAINTS)
    expect(match).toBeUndefined()
  })

  it("does not block git diff", () => {
    const match = findMatchingConstraint("git diff HEAD", GIT_WORKFLOW_CONSTRAINTS)
    expect(match).toBeUndefined()
  })
})

describe("GIT_DESTRUCTIVE_CONSTRAINTS", () => {
  it("blocks git push --force", () => {
    const match = findMatchingConstraint("git push --force", GIT_DESTRUCTIVE_CONSTRAINTS)
    expect(match).toBeDefined()
    expect(match!.name).toBe("git-force-push")
  })

  it("blocks git push origin main --force", () => {
    const match = findMatchingConstraint("git push origin main --force", GIT_DESTRUCTIVE_CONSTRAINTS)
    expect(match).toBeDefined()
  })

  it("blocks git reset --hard", () => {
    const match = findMatchingConstraint("git reset --hard", GIT_DESTRUCTIVE_CONSTRAINTS)
    expect(match).toBeDefined()
    expect(match!.name).toBe("git-hard-reset")
  })

  it("blocks git reset --hard HEAD~1", () => {
    const match = findMatchingConstraint("git reset --hard HEAD~1", GIT_DESTRUCTIVE_CONSTRAINTS)
    expect(match).toBeDefined()
  })

  it("blocks git clean -f", () => {
    const match = findMatchingConstraint("git clean -f", GIT_DESTRUCTIVE_CONSTRAINTS)
    expect(match).toBeDefined()
    expect(match!.name).toBe("git-clean-force")
  })

  it("blocks git checkout .", () => {
    const match = findMatchingConstraint("git checkout .", GIT_DESTRUCTIVE_CONSTRAINTS)
    expect(match).toBeDefined()
    expect(match!.name).toBe("git-checkout-all")
  })

  it("allows git push without --force", () => {
    const match = findMatchingConstraint("git push origin main", GIT_DESTRUCTIVE_CONSTRAINTS)
    expect(match).toBeUndefined()
  })

  it("allows git reset --soft", () => {
    const match = findMatchingConstraint("git reset --soft HEAD~1", GIT_DESTRUCTIVE_CONSTRAINTS)
    expect(match).toBeUndefined()
  })

  it("allows git checkout <branch>", () => {
    const match = findMatchingConstraint("git checkout feature/foo", GIT_DESTRUCTIVE_CONSTRAINTS)
    expect(match).toBeUndefined()
  })
})

describe("checkBashCommand", () => {
  it("returns ok for safe commands", () => {
    expect(checkBashCommand("bun test")).toEqual({ ok: true })
    expect(checkBashCommand("ls -la")).toEqual({ ok: true })
    expect(checkBashCommand("git status")).toEqual({ ok: true })
  })

  it("returns not-ok for blocked commands", () => {
    const result = checkBashCommand("git add .")
    expect(result.ok).toBe(false)
  })

  it("checks all constraint groups", () => {
    expect(BASH_CONSTRAINTS.length).toBe(GIT_WORKFLOW_CONSTRAINTS.length + GIT_DESTRUCTIVE_CONSTRAINTS.length)
  })
})

describe("findMatchingConstraint", () => {
  it("returns undefined for non-matching command", () => {
    expect(findMatchingConstraint("echo hello", BASH_CONSTRAINTS)).toBeUndefined()
  })

  it("returns the first matching constraint", () => {
    const match = findMatchingConstraint("git add .", BASH_CONSTRAINTS)
    expect(match).toBeDefined()
    expect(match!.name).toBe("git-add")
  })
})
