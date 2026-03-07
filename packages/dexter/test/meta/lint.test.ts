import { describe, expect, it } from "bun:test"
import { lint } from "../../src/meta/domain/lint.ts"
import { mockPorts, mockProcessHandle } from "./mocks.ts"

import type { ProcessPort } from "../../src/meta/ports.ts"
import type { QueryResult } from "../../src/meta/types.ts"

type CheckResult = Extract<QueryResult, { what: "lint" }>

function lintProcess(output: string, exitCode = 1): ProcessPort {
  return {
    spawn() {
      const handle = mockProcessHandle(exitCode)
      const origWait = handle.wait
      const listeners: ((line: string) => void)[] = []
      handle.onLine = (stream, cb) => {
        if (stream === "stdout") listeners.push(cb)
      }
      handle.wait = () => {
        for (const line of output.split("\n").filter(Boolean)) {
          for (const cb of listeners) cb(line)
        }
        return origWait()
      }
      return handle
    },
  }
}

describe("query lint", () => {
  it("runs eslint and returns structured check data", async () => {
    const lintOutput = "src/index.ts:5:1  error  no-unused-vars  'x' is unused"
    const ports = mockPorts({
      fs: {
        exists: (path: string) => {
          if (path === "/repo/package.json") return true
          if (path === "/repo/meta/src/index.ts") return true
          return false
        },
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: [] })
          throw new Error(`ENOENT: ${path}`)
        },
        writeFile: () => {},
        readDir: () => [],
        unlink: () => {},
        mkdir: () => {},
      },
      git: {
        run(args: string[]) {
          if (args[0] === "ls-files") {
            return { success: true, stdout: "meta/src/index.ts", stderr: "" }
          }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: lintProcess(lintOutput),
    })

    const result = (await lint(ports, ["meta"])) as CheckResult
    expect(result.what).toBe("lint")
    expect(result.data.errorCount).toBe(1)
    expect(result.data.errors[0]!.summary).toContain("no-unused-vars")
    expect(result.data.raw).toContain("no-unused-vars")
  })

  it("returns zero errors when no lintable files", async () => {
    const ports = mockPorts({
      git: {
        run(args: string[]) {
          if (args[0] === "ls-files") {
            return { success: true, stdout: "meta/README.md\nmeta/package.json", stderr: "" }
          }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
    })

    const result = (await lint(ports, ["meta"])) as CheckResult
    expect(result.data.errorCount).toBe(0)
    expect(result.data.errors).toEqual([])
  })

  it("routes to package dir when package has own eslint config", async () => {
    let spawnCwd: string | undefined
    let spawnArgs: string[] = []
    const ports = mockPorts({
      fs: {
        exists: (path: string) => {
          if (path === "/repo/apps/dimas-web/eslint.config.js") return true
          if (path === "/repo/apps/dimas-web/package.json") return true
          if (path === "/repo/apps/dimas-web/src/App.tsx") return true
          if (path === "/repo/package.json") return true
          return false
        },
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: ["apps/*"] })
          if (path === "/repo/apps/dimas-web/package.json")
            return JSON.stringify({ name: "@asombro/dimas-web", scripts: {} })
          throw new Error(`ENOENT: ${path}`)
        },
        writeFile: () => {},
        readDir: (path: string) => {
          if (path === "/repo/apps") return [{ name: "dimas-web", isDirectory: true }]
          return []
        },
        unlink: () => {},
        mkdir: () => {},
      },
      git: {
        run(args: string[]) {
          if (args[0] === "ls-files") {
            return { success: true, stdout: "apps/dimas-web/src/App.tsx", stderr: "" }
          }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: {
        spawn(params) {
          spawnCwd = params.cwd
          spawnArgs = params.args ?? []
          return mockProcessHandle(0)
        },
      },
    })

    await lint(ports, ["apps/dimas-web"])
    expect(spawnCwd).toBe("/repo/apps/dimas-web")
    expect(spawnArgs).toContain("src/App.tsx")
    expect(spawnArgs).not.toContain("apps/dimas-web/src/App.tsx")
  })
})

// === --changed mode ===

describe("query lint --changed", () => {
  it("uses only dirty files, not all tracked", async () => {
    let lintedFiles: string[] = []
    const ports = mockPorts({
      fs: {
        exists: (path: string) => {
          if (path === "/repo/package.json") return true
          if (path === "/repo/meta/src/changed.ts") return true
          return false
        },
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: [] })
          throw new Error(`ENOENT: ${path}`)
        },
        writeFile: () => {},
        readDir: () => [],
        unlink: () => {},
        mkdir: () => {},
      },
      git: {
        run(args: string[]) {
          if (args[0] === "diff" && args[1] === "--name-only") {
            return { success: true, stdout: "meta/src/changed.ts", stderr: "" }
          }
          if (args[0] === "ls-files" && args[1] === "--others") {
            return { success: true, stdout: "", stderr: "" }
          }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: {
        spawn(params) {
          lintedFiles = params.args?.filter((a) => a.endsWith(".ts")) ?? []
          return mockProcessHandle(0)
        },
      },
    })

    const result = (await lint(ports, ["meta"], { changed: true })) as CheckResult
    expect(result.data.errorCount).toBe(0)
    expect(lintedFiles).toEqual(["meta/src/changed.ts"])
  })

  it("deduplicates modified and untracked files", async () => {
    let lintedFiles: string[] = []
    const ports = mockPorts({
      fs: {
        exists: (path: string) => {
          if (path === "/repo/package.json") return true
          if (path === "/repo/meta/src/overlap.ts") return true
          return false
        },
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: [] })
          throw new Error(`ENOENT: ${path}`)
        },
        writeFile: () => {},
        readDir: () => [],
        unlink: () => {},
        mkdir: () => {},
      },
      git: {
        run(args: string[]) {
          if (args[0] === "diff" && args[1] === "--name-only") {
            return { success: true, stdout: "meta/src/overlap.ts", stderr: "" }
          }
          if (args[0] === "ls-files" && args[1] === "--others") {
            return { success: true, stdout: "meta/src/overlap.ts", stderr: "" }
          }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: {
        spawn(params) {
          lintedFiles = params.args?.filter((a) => a.endsWith(".ts")) ?? []
          return mockProcessHandle(0)
        },
      },
    })

    await lint(ports, ["meta"], { changed: true })
    expect(lintedFiles).toEqual(["meta/src/overlap.ts"])
  })

  it("returns zero errors when no changed lintable files", async () => {
    const ports = mockPorts({
      git: {
        run(args: string[]) {
          if (args[0] === "diff" && args[1] === "--name-only") {
            return { success: true, stdout: "meta/README.md", stderr: "" }
          }
          if (args[0] === "ls-files" && args[1] === "--others") {
            return { success: true, stdout: "", stderr: "" }
          }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
    })

    const result = (await lint(ports, ["meta"], { changed: true })) as CheckResult
    expect(result.data.errorCount).toBe(0)
    expect(result.data.errors).toEqual([])
  })

  it("returns errors from changed files", async () => {
    const lintOutput = "meta/src/bad.ts:10:5  error  no-unused-vars  'y' is unused"
    const ports = mockPorts({
      fs: {
        exists: (path: string) => {
          if (path === "/repo/package.json") return true
          if (path === "/repo/meta/src/bad.ts") return true
          return false
        },
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: [] })
          throw new Error(`ENOENT: ${path}`)
        },
        writeFile: () => {},
        readDir: () => [],
        unlink: () => {},
        mkdir: () => {},
      },
      git: {
        run(args: string[]) {
          if (args[0] === "diff" && args[1] === "--name-only") {
            return { success: true, stdout: "meta/src/bad.ts", stderr: "" }
          }
          if (args[0] === "ls-files" && args[1] === "--others") {
            return { success: true, stdout: "", stderr: "" }
          }
          return { success: true, stdout: "", stderr: "" }
        },
        checkIgnore: () => false,
      },
      process: lintProcess(lintOutput),
    })

    const result = (await lint(ports, ["meta"], { changed: true })) as CheckResult
    expect(result.data.errorCount).toBe(1)
    expect(result.data.errors[0]!.summary).toContain("no-unused-vars")
  })
})
