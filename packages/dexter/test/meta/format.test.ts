import { describe, expect, it } from "bun:test"
import { isErrorLine, extractErrors } from "../../src/meta/domain/format.ts"

describe("isErrorLine", () => {
  it("detects ESLint-style errors", () => {
    expect(isErrorLine("src/chat.ts:42:5  error  no-unused-vars  'x' is unused")).toBe(true)
  })

  it("detects TypeScript-style errors", () => {
    expect(isErrorLine("src/index.ts(10,5): error TS2322: Type 'string'")).toBe(true)
  })

  it("detects bun test failure markers", () => {
    expect(isErrorLine("✗ should handle empty input")).toBe(true)
  })

  it("detects FAIL markers", () => {
    expect(isErrorLine("FAIL src/index.test.ts")).toBe(true)
  })

  it("rejects non-error lines", () => {
    expect(isErrorLine("All files passed linting.")).toBe(false)
    expect(isErrorLine("Done in 0.5s")).toBe(false)
    expect(isErrorLine("checking files...")).toBe(false)
  })
})

describe("extractErrors", () => {
  it("returns zero errors for empty input", () => {
    const result = extractErrors("")
    expect(result.errorCount).toBe(0)
    expect(result.errors).toEqual([])
  })

  it("returns zero errors for whitespace-only input", () => {
    const result = extractErrors("  \n  ")
    expect(result.errorCount).toBe(0)
    expect(result.errors).toEqual([])
  })

  it("returns zero errors when no error lines detected", () => {
    const result = extractErrors("All files passed linting.\nDone in 0.5s")
    expect(result.errorCount).toBe(0)
    expect(result.errors).toEqual([])
    expect(result.raw).toContain("All files passed linting.")
  })

  it("extracts single error", () => {
    const raw = "src/chat.ts:42:5  error  no-unused-vars  'x' is declared but never used"
    const result = extractErrors(raw)

    expect(result.errorCount).toBe(1)
    expect(result.errors[0]!.line).toBe(1)
    expect(result.errors[0]!.summary).toContain("no-unused-vars")
    expect(result.raw).toBe(raw)
  })

  it("extracts multiple errors", () => {
    const raw = [
      "src/chat.ts:42:5  error  no-unused-vars  'x' is unused",
      "src/utils.ts:15:1  error  prefer-const  Use const",
    ].join("\n")
    const result = extractErrors(raw)

    expect(result.errorCount).toBe(2)
    expect(result.errors[0]!.summary).toContain("no-unused-vars")
    expect(result.errors[1]!.summary).toContain("prefer-const")
  })

  it("skips non-error lines in mixed output", () => {
    const raw = ["checking files...", "src/a.ts:1:1  error  rule  msg", "done", "src/b.ts:2:1  error  rule  msg"].join(
      "\n",
    )
    const result = extractErrors(raw)

    expect(result.errorCount).toBe(2)
    expect(result.errors[0]!.line).toBe(2)
    expect(result.errors[1]!.line).toBe(4)
  })

  it("truncates long error summaries", () => {
    const longLine = "src/chat.ts:42:5  error  " + "a".repeat(100)
    const result = extractErrors(longLine)

    expect(result.errors[0]!.summary.length).toBeLessThanOrEqual(80)
    expect(result.errors[0]!.summary).toEndWith("...")
  })

  it("preserves raw output", () => {
    const raw = "src/a.ts:1:1  error  rule  msg\nAll done."
    const result = extractErrors(raw)
    expect(result.raw).toBe(raw)
  })
})
