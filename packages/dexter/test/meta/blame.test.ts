/**
 * Git blame tests — porcelain parsing, range grouping, ignore-revs, errors.
 */

import { describe, expect, it } from "bun:test"

import { blame } from "../../src/meta/domain/blame.ts"
import { ControlError } from "../../src/meta/errors.ts"
import type { GitPort } from "../../src/meta/ports.ts"
import type { GitResult } from "../../src/meta/types.ts"
import { mockPorts } from "./mocks.ts"

type BlameResult = Extract<GitResult, { what: "blame" }>

// Sample porcelain output for two commits across 4 lines
const PORCELAIN_TWO_RANGES = `4a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b 1 1 2
author Alice
author-mail <alice@example.com>
author-time 1700000000
author-tz +0000
committer Alice
committer-mail <alice@example.com>
committer-time 1700000000
committer-tz +0000
summary add initial types
filename meta/src/types.ts
\texport type Foo = {
4a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b 2 2
author Alice
author-mail <alice@example.com>
author-time 1700000000
author-tz +0000
committer Alice
committer-mail <alice@example.com>
committer-time 1700000000
committer-tz +0000
summary add initial types
filename meta/src/types.ts
\t  name: string
b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0 3 3 2
author Bob
author-mail <bob@example.com>
author-time 1700100000
author-tz +0000
committer Bob
committer-mail <bob@example.com>
committer-time 1700100000
committer-tz +0000
summary extend Foo with age field
filename meta/src/types.ts
\t  age: number
b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0 4 4
author Bob
author-mail <bob@example.com>
author-time 1700100000
author-tz +0000
committer Bob
committer-mail <bob@example.com>
committer-time 1700100000
committer-tz +0000
summary extend Foo with age field
filename meta/src/types.ts
\t}`

function blameGit(stdout: string): GitPort {
  return {
    run(args: string[]) {
      if (args[0] === "blame") {
        return { success: true, stdout, stderr: "" }
      }
      return { success: true, stdout: "", stderr: "" }
    },
    checkIgnore: () => false,
  }
}

describe("git blame", () => {
  describe("porcelain parsing and range grouping", () => {
    it("groups consecutive lines from same commit into ranges", () => {
      const ports = mockPorts({
        git: blameGit(PORCELAIN_TWO_RANGES),
      })

      const result = blame(ports, "meta/src/types.ts") as BlameResult
      expect(result.what).toBe("blame")
      expect(result.file).toBe("meta/src/types.ts")
      expect(result.ranges).toHaveLength(2)

      const r1 = result.ranges[0]!
      expect(r1.commit).toBe("4a2b3c4d")
      expect(r1.author).toBe("Alice")
      expect(r1.message).toBe("add initial types")
      expect(r1.startLine).toBe(1)
      expect(r1.endLine).toBe(2)
      expect(r1.content).toEqual(["export type Foo = {", "  name: string"])

      const r2 = result.ranges[1]!
      expect(r2.commit).toBe("b1c2d3e4")
      expect(r2.author).toBe("Bob")
      expect(r2.message).toBe("extend Foo with age field")
      expect(r2.startLine).toBe(3)
      expect(r2.endLine).toBe(4)
      expect(r2.content).toEqual(["  age: number", "}"])
    })

    it("returns empty ranges for empty output", () => {
      const ports = mockPorts({ git: blameGit("") })
      const result = blame(ports, "meta/src/types.ts") as BlameResult
      expect(result.ranges).toHaveLength(0)
    })
  })

  describe("line range filtering", () => {
    it("passes -L flag when lines specified", () => {
      let capturedArgs: string[] = []
      const ports = mockPorts({
        git: {
          run(args: string[]) {
            if (args[0] === "blame") capturedArgs = args
            return { success: true, stdout: "", stderr: "" }
          },
          checkIgnore: () => false,
        },
      })

      blame(ports, "meta/src/types.ts", [10, 20])
      expect(capturedArgs).toContain("-L")
      expect(capturedArgs).toContain("10,20")
    })
  })

  describe("ignore-revs", () => {
    it("passes --ignore-revs-file when .git-blame-ignore-revs exists", () => {
      let capturedArgs: string[] = []
      const ports = mockPorts({
        git: {
          run(args: string[]) {
            if (args[0] === "blame") capturedArgs = args
            return { success: true, stdout: "", stderr: "" }
          },
          checkIgnore: () => false,
        },
        fs: {
          exists: (path: string) => path.endsWith(".git-blame-ignore-revs") || !path.includes("nonexistent"),
          readFile: () => "",
          writeFile: () => {},
          readDir: () => [],
          unlink: () => {},
          mkdir: () => {},
        },
      })

      blame(ports, "meta/src/types.ts")
      expect(capturedArgs).toContain("--ignore-revs-file")
      expect(capturedArgs).toContain(".git-blame-ignore-revs")
    })

    it("omits --ignore-revs-file when file does not exist", () => {
      let capturedArgs: string[] = []
      const ports = mockPorts({
        git: {
          run(args: string[]) {
            if (args[0] === "blame") capturedArgs = args
            return { success: true, stdout: "", stderr: "" }
          },
          checkIgnore: () => false,
        },
        fs: {
          exists: (path: string) => !path.endsWith(".git-blame-ignore-revs"),
          readFile: () => "",
          writeFile: () => {},
          readDir: () => [],
          unlink: () => {},
          mkdir: () => {},
        },
      })

      blame(ports, "meta/src/types.ts")
      expect(capturedArgs).not.toContain("--ignore-revs-file")
    })
  })

  describe("errors", () => {
    it("throws file_not_found when file does not exist", () => {
      const ports = mockPorts({
        fs: {
          exists: () => false,
          readFile: () => "",
          writeFile: () => {},
          readDir: () => [],
          unlink: () => {},
          mkdir: () => {},
        },
      })

      try {
        blame(ports, "nonexistent.ts")
        expect.unreachable("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(ControlError)
        expect((err as ControlError).code).toBe("file_not_found")
      }
    })

    it("throws blame_failed when git blame fails", () => {
      const ports = mockPorts({
        git: {
          run: () => ({ success: false, stdout: "", stderr: "fatal: no such path" }),
          checkIgnore: () => false,
        },
      })

      try {
        blame(ports, "meta/src/types.ts")
        expect.unreachable("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(ControlError)
        expect((err as ControlError).code).toBe("blame_failed")
      }
    })
  })

  describe("date formatting", () => {
    it("formats author-time as ISO date", () => {
      const ports = mockPorts({ git: blameGit(PORCELAIN_TWO_RANGES) })
      const result = blame(ports, "meta/src/types.ts") as BlameResult
      // 1700000000 = 2023-11-14
      expect(result.ranges[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})
