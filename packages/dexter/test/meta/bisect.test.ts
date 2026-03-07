/**
 * Git bisect tests — multi-step sequence, cleanup, timeout, errors.
 */

import { describe, expect, it } from "bun:test"

import { bisect } from "../../src/meta/domain/bisect.ts"
import { ControlError } from "../../src/meta/errors.ts"
import type { GitPort, ProcessHandle } from "../../src/meta/ports.ts"
import type { GitResult } from "../../src/meta/types.ts"
import { mockPorts } from "./mocks.ts"

type BisectResult = Extract<GitResult, { what: "bisect" }>

const FIRST_BAD_HASH = "4a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b"

const BISECT_RUN_OUTPUT = [
  "Bisecting: 3 revisions left to test after this (roughly 2 steps)",
  "running sh -c bun test test/foo.test.ts",
  `${FIRST_BAD_HASH} is the first bad commit`,
  `commit ${FIRST_BAD_HASH}`,
  "Author: Alice <alice@example.com>",
  "Date:   Mon Nov 14 12:00:00 2023 +0000",
  "",
  "    break the foo test",
]

function bisectGit(opts: { resetCalled?: { count: number } } = {}): GitPort {
  return {
    run(args: string[]) {
      const sub = args[1]

      if (args[0] === "rev-parse" && args[1] === "--verify") {
        return { success: true, stdout: "abc123\n", stderr: "" }
      }

      if (args[0] === "bisect") {
        if (sub === "log") {
          // Not already bisecting
          return { success: false, stdout: "", stderr: "" }
        }
        if (sub === "start" || sub === "bad" || sub === "good") {
          return { success: true, stdout: "", stderr: "" }
        }
        if (sub === "reset") {
          if (opts.resetCalled) opts.resetCalled.count++
          return { success: true, stdout: "", stderr: "" }
        }
      }

      if (args[0] === "show" && args.includes("--stat")) {
        return {
          success: true,
          stdout: "Alice\n2023-11-14 12:00:00 +0000\nbreak the foo test\n meta/src/foo.ts | 2 +-",
          stderr: "",
        }
      }

      if (args[0] === "show" && args.includes("--patch")) {
        return {
          success: true,
          stdout: "--- a/foo.ts\n+++ b/foo.ts\n@@ -1 +1 @@\n-good\n+bad",
          stderr: "",
        }
      }

      return { success: true, stdout: "", stderr: "" }
    },
    checkIgnore: () => false,
  }
}

function bisectProcessHandle(output: string[], exitCode: number = 0): ProcessHandle {
  const listeners: Record<string, ((line: string) => void)[]> = {}
  return {
    onLine(stream: "stdout" | "stderr", cb: (line: string) => void) {
      ;(listeners[stream] ??= []).push(cb)
    },
    wait() {
      // Deliver lines then resolve
      for (const line of output) {
        for (const cb of listeners["stdout"] ?? []) cb(line)
      }
      return Promise.resolve(exitCode)
    },
  }
}

describe("git bisect", () => {
  describe("successful bisect", () => {
    it("finds the first bad commit", async () => {
      const ports = mockPorts({
        git: bisectGit(),
        process: {
          spawn: () => bisectProcessHandle(BISECT_RUN_OUTPUT),
        },
      })

      const result = (await bisect(ports, "bun test test/foo.test.ts", "HEAD~10")) as BisectResult
      expect(result.what).toBe("bisect")
      expect(result.match.hash).toBe("4a2b3c4d")
      expect(result.match.author).toBe("Alice")
      expect(result.match.date).toBe("2023-11-14")
      expect(result.match.message).toBe("break the foo test")
      expect(result.match.diff).toContain("-good")
      expect(result.match.diff).toContain("+bad")
    })
  })

  describe("cleanup", () => {
    it("always calls git bisect reset, even on success", async () => {
      const resetCalled = { count: 0 }
      const ports = mockPorts({
        git: bisectGit({ resetCalled }),
        process: {
          spawn: () => bisectProcessHandle(BISECT_RUN_OUTPUT),
        },
      })

      await bisect(ports, "bun test test/foo.test.ts", "HEAD~10")
      expect(resetCalled.count).toBe(1)
    })

    it("calls git bisect reset on failure", async () => {
      const resetCalled = { count: 0 }
      const ports = mockPorts({
        git: bisectGit({ resetCalled }),
        process: {
          spawn: () => bisectProcessHandle(["no match found"]),
        },
      })

      try {
        await bisect(ports, "bun test test/foo.test.ts", "HEAD~10")
        expect.unreachable("should have thrown")
      } catch {
        // Expected
      }
      expect(resetCalled.count).toBe(1)
    })
  })

  describe("timeout", () => {
    it("passes timeout to process spawn", async () => {
      let capturedTimeout: number | undefined
      const ports = mockPorts({
        git: bisectGit(),
        process: {
          spawn(params) {
            capturedTimeout = params.timeout
            return bisectProcessHandle(BISECT_RUN_OUTPUT)
          },
        },
      })

      await bisect(ports, "bun test test/foo.test.ts", "HEAD~10", undefined, 60000)
      expect(capturedTimeout).toBe(60000)
    })

    it("uses default 5 minute timeout", async () => {
      let capturedTimeout: number | undefined
      const ports = mockPorts({
        git: bisectGit(),
        process: {
          spawn(params) {
            capturedTimeout = params.timeout
            return bisectProcessHandle(BISECT_RUN_OUTPUT)
          },
        },
      })

      await bisect(ports, "bun test test/foo.test.ts", "HEAD~10")
      expect(capturedTimeout).toBe(5 * 60 * 1000)
    })
  })

  describe("errors", () => {
    it("throws empty_test for empty command", async () => {
      const ports = mockPorts()
      try {
        await bisect(ports, "", "HEAD~10")
        expect.unreachable("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(ControlError)
        expect((err as ControlError).code).toBe("empty_test")
      }
    })

    it("throws no_good_ref for empty good ref", async () => {
      const ports = mockPorts()
      try {
        await bisect(ports, "bun test foo", "")
        expect.unreachable("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(ControlError)
        expect((err as ControlError).code).toBe("no_good_ref")
      }
    })

    it("throws bad_ref when good ref is invalid", async () => {
      const ports = mockPorts({
        git: {
          run(args: string[]) {
            if (args[0] === "rev-parse") return { success: false, stdout: "", stderr: "fatal" }
            return { success: true, stdout: "", stderr: "" }
          },
          checkIgnore: () => false,
        },
      })

      try {
        await bisect(ports, "bun test foo", "nonexistent-ref")
        expect.unreachable("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(ControlError)
        expect((err as ControlError).code).toBe("bad_ref")
      }
    })

    it("throws bisect_active when already bisecting", async () => {
      const ports = mockPorts({
        git: {
          run(args: string[]) {
            if (args[0] === "rev-parse") return { success: true, stdout: "abc\n", stderr: "" }
            if (args[0] === "bisect" && args[1] === "log") {
              return { success: true, stdout: "git bisect start\ngit bisect bad HEAD", stderr: "" }
            }
            return { success: true, stdout: "", stderr: "" }
          },
          checkIgnore: () => false,
        },
      })

      try {
        await bisect(ports, "bun test foo", "HEAD~10")
        expect.unreachable("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(ControlError)
        expect((err as ControlError).code).toBe("bisect_active")
      }
    })

    it("throws bisect_inconclusive when no bad commit found", async () => {
      const resetCalled = { count: 0 }
      const ports = mockPorts({
        git: bisectGit({ resetCalled }),
        process: {
          spawn: () => bisectProcessHandle(["all commits seem to be good"]),
        },
      })

      try {
        await bisect(ports, "bun test foo", "HEAD~10")
        expect.unreachable("should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(ControlError)
        expect((err as ControlError).code).toBe("bisect_inconclusive")
      }
    })
  })
})
