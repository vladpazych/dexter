/**
 * Git pickaxe tests — log parsing, regex mode, scope filtering, errors.
 */

import { describe, expect, it } from "bun:test"

import { pickaxe } from "../../src/meta/domain/pickaxe.ts"
import { ControlError } from "../../src/meta/errors.ts"
import type { GitPort } from "../../src/meta/ports.ts"
import type { GitResult } from "../../src/meta/types.ts"
import { mockPorts } from "./mocks.ts"

type PickaxeResult = Extract<GitResult, { what: "pickaxe" }>

const SAMPLE_LOG = `commit 4a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b
Author: Alice <alice@example.com>
Date:   Mon Nov 14 12:00:00 2023 +0000

    add ControlError class

diff --git a/meta/src/errors.ts b/meta/src/errors.ts
new file mode 100644
--- /dev/null
+++ b/meta/src/errors.ts
@@ -0,0 +1,5 @@
+export class ControlError extends Error {
+  readonly code: string
+}
commit b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0
Author: Bob Smith <bob@example.com>
Date:   Tue Nov 15 10:00:00 2023 +0000

    use ControlError in commit domain

diff --git a/meta/src/domain/commit.ts b/meta/src/domain/commit.ts
--- a/meta/src/domain/commit.ts
+++ b/meta/src/domain/commit.ts
@@ -1,2 +1,4 @@
+import { ControlError } from "../errors.js"
+throw new ControlError("bad", "msg")
`

function pickaxeGit(stdout: string): GitPort {
  return {
    run(args: string[]) {
      if (args[0] === "log") {
        return { success: true, stdout, stderr: "" }
      }
      return { success: true, stdout: "", stderr: "" }
    },
    checkIgnore: () => false,
  }
}

describe("git pickaxe", () => {
  describe("log parsing", () => {
    it("parses commit metadata and diff hunks", () => {
      const ports = mockPorts({ git: pickaxeGit(SAMPLE_LOG) })
      const result = pickaxe(ports, "ControlError") as PickaxeResult

      expect(result.what).toBe("pickaxe")
      expect(result.pattern).toBe("ControlError")
      expect(result.matches).toHaveLength(2)

      const m1 = result.matches[0]!
      expect(m1.hash).toBe("4a2b3c4d")
      expect(m1.author).toBe("Alice")
      expect(m1.date).toBe("2023-11-14")
      expect(m1.message).toBe("add ControlError class")
      expect(m1.diff).toContain("export class ControlError")

      const m2 = result.matches[1]!
      expect(m2.hash).toBe("b1c2d3e4")
      expect(m2.author).toBe("Bob Smith")
      expect(m2.message).toBe("use ControlError in commit domain")
      expect(m2.diff).toContain("throw new ControlError")
    })

    it("returns empty matches for no results", () => {
      const ports = mockPorts({ git: pickaxeGit("") })
      const result = pickaxe(ports, "nonexistent") as PickaxeResult
      expect(result.matches).toHaveLength(0)
    })
  })

  describe("search modes", () => {
    it("uses -S for literal string by default", () => {
      let capturedArgs: string[] = []
      const ports = mockPorts({
        git: {
          run(args: string[]) {
            if (args[0] === "log") capturedArgs = args
            return { success: true, stdout: "", stderr: "" }
          },
          checkIgnore: () => false,
        },
      })

      pickaxe(ports, "ControlError")
      expect(capturedArgs).toContain("-S")
      expect(capturedArgs).toContain("ControlError")
      expect(capturedArgs).not.toContain("-G")
    })

    it("uses -G for regex mode", () => {
      let capturedArgs: string[] = []
      const ports = mockPorts({
        git: {
          run(args: string[]) {
            if (args[0] === "log") capturedArgs = args
            return { success: true, stdout: "", stderr: "" }
          },
          checkIgnore: () => false,
        },
      })

      pickaxe(ports, "Control.*Error", { regex: true })
      expect(capturedArgs).toContain("-G")
      expect(capturedArgs).toContain("Control.*Error")
      expect(capturedArgs).not.toContain("-S")
    })
  })

  describe("scope filtering", () => {
    it("appends -- and scopes when provided", () => {
      let capturedArgs: string[] = []
      const ports = mockPorts({
        git: {
          run(args: string[]) {
            if (args[0] === "log") capturedArgs = args
            return { success: true, stdout: "", stderr: "" }
          },
          checkIgnore: () => false,
        },
      })

      pickaxe(ports, "foo", { scopes: ["meta/src/", "lib/"] })
      const ddIdx = capturedArgs.indexOf("--")
      expect(ddIdx).toBeGreaterThan(0)
      expect(capturedArgs.slice(ddIdx + 1)).toEqual(["meta/src/", "lib/"])
    })

    it("omits -- when no scopes", () => {
      let capturedArgs: string[] = []
      const ports = mockPorts({
        git: {
          run(args: string[]) {
            if (args[0] === "log") capturedArgs = args
            return { success: true, stdout: "", stderr: "" }
          },
          checkIgnore: () => false,
        },
      })

      pickaxe(ports, "foo")
      expect(capturedArgs).not.toContain("--")
    })
  })

  describe("errors", () => {
    it("throws empty_pattern for empty string", () => {
      const ports = mockPorts()
      try {
        pickaxe(ports, "")
        expect.unreachable("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(ControlError)
        expect((err as ControlError).code).toBe("empty_pattern")
      }
    })

    it("throws pickaxe_failed when git log fails", () => {
      const ports = mockPorts({
        git: {
          run: () => ({ success: false, stdout: "", stderr: "fatal: bad regex" }),
          checkIgnore: () => false,
        },
      })

      try {
        pickaxe(ports, "[invalid", { regex: true })
        expect.unreachable("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(ControlError)
        expect((err as ControlError).code).toBe("pickaxe_failed")
      }
    })
  })
})
