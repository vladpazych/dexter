/**
 * Commit Domain Tests
 *
 * Tests message validation, git state, file resolution (explicit only),
 * quality gates, isolated staging, and cleanup.
 */

import { describe, expect, it } from "bun:test"

import { commit } from "../../src/meta/domain/commit.ts"
import { ControlError } from "../../src/meta/errors.ts"
import type { SpawnResult } from "../../src/meta/ports.ts"
import { mockPorts, mockProcessHandle } from "./mocks.ts"

function commitPorts(gitFiles: string[] = ["src/index.ts"]) {
  let committed: { message: string } | undefined
  const ports = mockPorts({
    git: {
      run(args, _env?) {
        const cmd = args[0]
        if (cmd === "rev-parse" && args[1] === "--short") {
          return { success: true, stdout: "abc1234", stderr: "" }
        }
        if (cmd === "--version" || cmd === "rev-parse" || cmd === "read-tree") {
          return { success: true, stdout: "true", stderr: "" }
        }
        if (cmd === "diff" && args[1] === "--name-only") {
          return { success: true, stdout: gitFiles.join("\n"), stderr: "" }
        }
        if (cmd === "ls-files" && args[1] === "--others") {
          return { success: true, stdout: "", stderr: "" }
        }
        if (cmd === "ls-tree") {
          return { success: true, stdout: args[3] ?? "", stderr: "" }
        }
        if (cmd === "add") {
          return { success: true, stdout: "", stderr: "" }
        }
        if (cmd === "diff" && args[1] === "--cached") {
          return { success: false, stdout: "", stderr: "" }
        }
        if (cmd === "commit") {
          committed = { message: args[args.indexOf("-m") + 1]! }
          return { success: true, stdout: "", stderr: "" }
        }
        if (cmd === "diff-tree") {
          return { success: true, stdout: gitFiles.join("\n"), stderr: "" }
        }
        if (cmd === "reset") {
          return { success: true, stdout: "", stderr: "" }
        }
        if (cmd === "ls-files") {
          return { success: true, stdout: gitFiles.join("\n"), stderr: "" }
        }
        return { success: true, stdout: "", stderr: "" }
      },
      checkIgnore: () => false,
    },
    process: {
      spawn: () => mockProcessHandle(0),
    },
  })
  return { ports, getCommitted: () => committed }
}

// === Message validation ===

describe("commit message validation", () => {
  it("rejects empty message", async () => {
    const { ports } = commitPorts()
    try {
      await commit(ports, { message: "", files: ["src/index.ts"] })
      expect.unreachable("should throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ControlError)
      expect((err as ControlError).code).toBe("empty_message")
    }
  })

  it("rejects message exceeding 72 characters", async () => {
    const { ports } = commitPorts()
    const longMessage = "a".repeat(73)
    try {
      await commit(ports, { message: longMessage, files: ["src/index.ts"] })
      expect.unreachable("should throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ControlError)
      expect((err as ControlError).code).toBe("message_too_long")
    }
  })

  it("accepts message at exactly 72 characters", async () => {
    const { ports } = commitPorts()
    const result = await commit(ports, { message: "a".repeat(72), files: ["src/index.ts"] })
    expect(result.hash).toBe("abc1234")
  })

  it("accepts short message", async () => {
    const { ports } = commitPorts()
    const result = await commit(ports, { message: "fix auth token expiry on refresh", files: ["src/index.ts"] })
    expect(result.hash).toBe("abc1234")
  })

  it("commits with exact message text", async () => {
    const { ports, getCommitted } = commitPorts()
    await commit(ports, { message: "explicit file list for commits", files: ["src/index.ts"] })
    expect(getCommitted()!.message).toBe("explicit file list for commits")
  })
})

// === Git state validation ===

describe("commit git state validation", () => {
  it("throws git_not_found when git is not available", async () => {
    const ports = mockPorts({
      git: {
        run(args) {
          if (args[0] === "--version") return { success: false, stdout: "", stderr: "not found" }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: { spawn: () => mockProcessHandle(0) },
    })

    try {
      await commit(ports, { message: "test", files: ["src/index.ts"] })
      expect.unreachable("should throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ControlError)
      expect((err as ControlError).code).toBe("git_not_found")
    }
  })

  it("throws not_repo outside a git repository", async () => {
    const ports = mockPorts({
      git: {
        run(args) {
          if (args[0] === "--version") return { success: true, stdout: "git 2.x", stderr: "" }
          if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree")
            return { success: false, stdout: "", stderr: "not a repo" }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: { spawn: () => mockProcessHandle(0) },
    })

    try {
      await commit(ports, { message: "test", files: ["src/index.ts"] })
      expect.unreachable("should throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ControlError)
      expect((err as ControlError).code).toBe("not_repo")
    }
  })

  it("throws no_commits when repo has no HEAD", async () => {
    const ports = mockPorts({
      git: {
        run(args) {
          if (args[0] === "--version") return { success: true, stdout: "git 2.x", stderr: "" }
          if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree")
            return { success: true, stdout: "true", stderr: "" }
          if (args[0] === "rev-parse" && args[1] === "HEAD")
            return { success: false, stdout: "", stderr: "unknown revision" }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: { spawn: () => mockProcessHandle(0) },
    })

    try {
      await commit(ports, { message: "test", files: ["src/index.ts"] })
      expect.unreachable("should throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ControlError)
      expect((err as ControlError).code).toBe("no_commits")
    }
  })
})

// === File resolution ===

describe("commit file resolution", () => {
  it("uses explicit files", async () => {
    const { ports } = commitPorts(["src/a.ts", "src/b.ts"])
    const result = await commit(ports, { message: "test explicit files", files: ["src/a.ts"] })
    expect(result.files).toBeDefined()
  })

  it("throws no_files when file list is empty", async () => {
    const { ports } = commitPorts()

    try {
      await commit(ports, { message: "test", files: [] })
      expect.unreachable("should throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ControlError)
      expect((err as ControlError).code).toBe("no_files")
    }
  })
})

// === Quality gates ===

describe("commit quality gates", () => {
  function failingQualityPorts() {
    return mockPorts({
      git: {
        run(args) {
          const cmd = args[0]
          if (cmd === "--version" || cmd === "rev-parse" || cmd === "read-tree")
            return { success: true, stdout: "true", stderr: "" }
          if (cmd === "diff" && args[1] === "--name-only") return { success: true, stdout: "src/index.ts", stderr: "" }
          if (cmd === "ls-files" && args[1] === "--others") return { success: true, stdout: "", stderr: "" }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: { spawn: () => mockProcessHandle(1) },
    })
  }

  it("blocks commit when quality checks fail", async () => {
    const ports = failingQualityPorts()

    try {
      await commit(ports, { message: "test", files: ["src/index.ts"] })
      expect.unreachable("should throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ControlError)
      expect((err as ControlError).code).toBe("quality_failed")
    }
  })

  it("includes diagnostics in quality failure hints", async () => {
    const ports = failingQualityPorts()

    try {
      await commit(ports, { message: "test", files: ["src/index.ts"] })
      expect.unreachable("should throw")
    } catch (err) {
      expect((err as ControlError).hints.length).toBeGreaterThan(0)
    }
  })
})

// === Isolated staging ===

describe("commit isolated staging", () => {
  it("passes GIT_INDEX_FILE env to staging commands", async () => {
    const envs: Array<Record<string, string> | undefined> = []
    const ports = mockPorts({
      git: {
        run(args, env?) {
          envs.push(env)
          const cmd = args[0]
          if (cmd === "rev-parse" && args[1] === "--short") return { success: true, stdout: "abc1234", stderr: "" }
          if (cmd === "--version" || cmd === "rev-parse" || cmd === "read-tree")
            return { success: true, stdout: "true", stderr: "" }
          if (cmd === "diff" && args[1] === "--name-only") return { success: true, stdout: "src/index.ts", stderr: "" }
          if (cmd === "ls-files" && args[1] === "--others") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-tree") return { success: true, stdout: args[3] ?? "", stderr: "" }
          if (cmd === "diff" && args[1] === "--cached") return { success: false, stdout: "", stderr: "" }
          if (cmd === "diff-tree") return { success: true, stdout: "src/index.ts", stderr: "" }
          if (cmd === "commit") return { success: true, stdout: "", stderr: "" }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: { spawn: () => mockProcessHandle(0) },
    })

    await commit(ports, { message: "test", files: ["src/index.ts"] })

    const withIndex = envs.filter((e) => e?.GIT_INDEX_FILE)
    expect(withIndex.length).toBeGreaterThan(0)
    expect(withIndex[0]!.GIT_INDEX_FILE).toContain("git-index")
  })

  it("throws file_not_found for nonexistent untracked file", async () => {
    const ports = mockPorts({
      git: {
        run(args) {
          const cmd = args[0]
          if (cmd === "--version" || cmd === "rev-parse" || cmd === "read-tree")
            return { success: true, stdout: "true", stderr: "" }
          if (cmd === "diff" && args[1] === "--name-only") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-files" && args[1] === "--others") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-tree") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-files") return { success: true, stdout: "src/similar.ts", stderr: "" }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      fs: {
        exists: (path: string) => !path.includes("ghost"),
        readFile: () => "{}",
        writeFile: () => {},
        readDir: () => [],
        unlink: () => {},
        mkdir: () => {},
      },
      process: { spawn: () => mockProcessHandle(0) },
    })

    try {
      await commit(ports, { message: "test", files: ["ghost.ts"] })
      expect.unreachable("should throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ControlError)
      expect((err as ControlError).code).toBe("file_not_found")
    }
  })

  it("suggests similar files when file not found", async () => {
    const ports = mockPorts({
      git: {
        run(args) {
          const cmd = args[0]
          if (cmd === "--version" || cmd === "rev-parse" || cmd === "read-tree")
            return { success: true, stdout: "true", stderr: "" }
          if (cmd === "diff" && args[1] === "--name-only") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-files" && args[1] === "--others") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-tree") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-files") return { success: true, stdout: "src/index.ts\nsrc/main.ts", stderr: "" }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      fs: {
        exists: (path: string) => !path.includes("index"),
        readFile: () => "{}",
        writeFile: () => {},
        readDir: () => [],
        unlink: () => {},
        mkdir: () => {},
      },
      process: { spawn: () => mockProcessHandle(0) },
    })

    try {
      await commit(ports, { message: "test", files: ["index.ts"] })
      expect.unreachable("should throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ControlError)
      const hints = (err as ControlError).hints
      expect(hints.some((h) => h.includes("similar"))).toBe(true)
    }
  })

  it("throws file_ignored for gitignored file", async () => {
    const ports = mockPorts({
      git: {
        run(args) {
          const cmd = args[0]
          if (cmd === "--version" || cmd === "rev-parse" || cmd === "read-tree")
            return { success: true, stdout: "true", stderr: "" }
          if (cmd === "diff" && args[1] === "--name-only") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-files" && args[1] === "--others") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-tree") return { success: true, stdout: "", stderr: "" }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => true,
      },
      process: { spawn: () => mockProcessHandle(0) },
    })

    try {
      await commit(ports, { message: "test", files: ["dist/bundle.js"] })
      expect.unreachable("should throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ControlError)
      expect((err as ControlError).code).toBe("file_ignored")
    }
  })

  it("removes old-cased entry before staging case-only rename", async () => {
    const gitCalls: string[][] = []
    const ports = mockPorts({
      git: {
        run(args, _env?) {
          gitCalls.push(args)
          const cmd = args[0]
          if (cmd === "rev-parse" && args[1] === "--short") return { success: true, stdout: "abc1234", stderr: "" }
          if (cmd === "--version" || cmd === "rev-parse" || cmd === "read-tree")
            return { success: true, stdout: "true", stderr: "" }
          if (cmd === "diff" && args[1] === "--name-only") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-files" && args[1] === "--others") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-tree" && args[1] === "-r")
            return { success: true, stdout: "src/Components/App.tsx", stderr: "" }
          if (cmd === "ls-tree") return { success: true, stdout: args[3] ?? "", stderr: "" }
          if (cmd === "rm") return { success: true, stdout: "", stderr: "" }
          if (cmd === "add") return { success: true, stdout: "", stderr: "" }
          if (cmd === "diff" && args[1] === "--cached") return { success: false, stdout: "", stderr: "" }
          if (cmd === "diff-tree") return { success: true, stdout: "src/components/app.tsx", stderr: "" }
          if (cmd === "commit") return { success: true, stdout: "", stderr: "" }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: { spawn: () => mockProcessHandle(0) },
    })

    await commit(ports, { message: "rename to lowercase", files: ["src/components/app.tsx"] })

    const rmCall = gitCalls.find((c) => c[0] === "rm" && c.includes("src/Components/App.tsx"))
    expect(rmCall).toBeDefined()
    expect(rmCall).toEqual(["rm", "--cached", "--quiet", "--", "src/Components/App.tsx"])

    const addCall = gitCalls.find((c) => c[0] === "add" && c.includes("src/components/app.tsx"))
    expect(addCall).toBeDefined()

    const rmIdx = gitCalls.findIndex((c) => c[0] === "rm" && c.includes("src/Components/App.tsx"))
    const addIdx = gitCalls.findIndex((c) => c[0] === "add" && c.includes("src/components/app.tsx"))
    expect(rmIdx).toBeLessThan(addIdx)
  })

  it("skips rm when file casing matches HEAD", async () => {
    const gitCalls: string[][] = []
    const ports = mockPorts({
      git: {
        run(args, _env?) {
          gitCalls.push(args)
          const cmd = args[0]
          if (cmd === "rev-parse" && args[1] === "--short") return { success: true, stdout: "abc1234", stderr: "" }
          if (cmd === "--version" || cmd === "rev-parse" || cmd === "read-tree")
            return { success: true, stdout: "true", stderr: "" }
          if (cmd === "diff" && args[1] === "--name-only") return { success: true, stdout: "src/index.ts", stderr: "" }
          if (cmd === "ls-files" && args[1] === "--others") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-tree" && args[1] === "-r") return { success: true, stdout: "src/index.ts", stderr: "" }
          if (cmd === "ls-tree") return { success: true, stdout: args[3] ?? "", stderr: "" }
          if (cmd === "add") return { success: true, stdout: "", stderr: "" }
          if (cmd === "diff" && args[1] === "--cached") return { success: false, stdout: "", stderr: "" }
          if (cmd === "diff-tree") return { success: true, stdout: "src/index.ts", stderr: "" }
          if (cmd === "commit") return { success: true, stdout: "", stderr: "" }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: { spawn: () => mockProcessHandle(0) },
    })

    await commit(ports, { message: "test", files: ["src/index.ts"] })

    const rmCalls = gitCalls.filter((c) => c[0] === "rm")
    expect(rmCalls.length).toBe(0)
  })

  it("throws no_changes when staged files match HEAD", async () => {
    const ports = mockPorts({
      git: {
        run(args, _env?) {
          const cmd = args[0]
          if (cmd === "--version" || cmd === "rev-parse" || cmd === "read-tree")
            return { success: true, stdout: "true", stderr: "" }
          if (cmd === "diff" && args[1] === "--name-only") return { success: true, stdout: "src/index.ts", stderr: "" }
          if (cmd === "ls-files" && args[1] === "--others") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-tree") return { success: true, stdout: args[3] ?? "", stderr: "" }
          if (cmd === "add") return { success: true, stdout: "", stderr: "" }
          if (cmd === "diff" && args[1] === "--cached") return { success: true, stdout: "", stderr: "" }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: { spawn: () => mockProcessHandle(0) },
    })

    try {
      await commit(ports, { message: "test", files: ["src/index.ts"] })
      expect.unreachable("should throw")
    } catch (err) {
      expect(err).toBeInstanceOf(ControlError)
      expect((err as ControlError).code).toBe("no_changes")
    }
  })
})

// === Cleanup ===

describe("commit cleanup", () => {
  it("deletes temp index after success", async () => {
    let unlinkCalled = false
    const { ports } = commitPorts()
    const originalUnlink = ports.fs.unlink
    ports.fs.unlink = (path: string) => {
      unlinkCalled = true
      originalUnlink(path)
    }

    await commit(ports, { message: "test", files: ["src/index.ts"] })
    expect(unlinkCalled).toBe(true)
  })

  it("deletes temp index after failure", async () => {
    let unlinkCalled = false
    const ports = mockPorts({
      git: {
        run(args) {
          const cmd = args[0]
          if (cmd === "--version" || cmd === "rev-parse" || cmd === "read-tree")
            return { success: true, stdout: "true", stderr: "" }
          if (cmd === "diff" && args[1] === "--name-only") return { success: true, stdout: "src/index.ts", stderr: "" }
          if (cmd === "ls-files" && args[1] === "--others") return { success: true, stdout: "", stderr: "" }
          if (cmd === "ls-tree") return { success: true, stdout: args[3] ?? "", stderr: "" }
          if (cmd === "add") return { success: true, stdout: "", stderr: "" }
          if (cmd === "diff" && args[1] === "--cached") return { success: false, stdout: "", stderr: "" }
          if (cmd === "commit") return { success: false, stdout: "", stderr: "commit failed" }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      fs: {
        exists: () => true,
        readFile: () => "{}",
        writeFile: () => {},
        readDir: () => [],
        unlink: () => {
          unlinkCalled = true
        },
        mkdir: () => {},
      },
      process: { spawn: () => mockProcessHandle(0) },
    })

    try {
      await commit(ports, { message: "test", files: ["src/index.ts"] })
    } catch {
      // Expected
    }

    expect(unlinkCalled).toBe(true)
  })

  it("syncs main index via git reset after commit", async () => {
    const gitCalls: string[][] = []
    const { ports } = commitPorts()
    const originalRun = ports.git.run
    ports.git.run = (args: string[], env?: Record<string, string>): SpawnResult => {
      gitCalls.push(args)
      return originalRun(args, env)
    }

    await commit(ports, { message: "test", files: ["src/index.ts"] })

    const resetCall = gitCalls.find((c) => c[0] === "reset")
    expect(resetCall).toBeDefined()
    expect(resetCall).toEqual(["reset", "--quiet", "HEAD"])
  })
})

// === Result shape ===

describe("commit result", () => {
  it("returns hash, message, and files", async () => {
    const { ports } = commitPorts(["src/index.ts"])
    const result = await commit(ports, { message: "explicit file list commits", files: ["src/index.ts"] })

    expect(result.hash).toBe("abc1234")
    expect(result.message).toBe("explicit file list commits")
    expect(result.files).toEqual(["src/index.ts"])
  })
})
