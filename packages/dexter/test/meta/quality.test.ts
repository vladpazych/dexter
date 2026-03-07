/**
 * Quality Gate Tests
 *
 * Tests file filtering whitelists and gate orchestration.
 */

import { describe, expect, it } from "bun:test"

import { isLintable, isFormattable, isTypecheckable, checkQuality } from "../../src/meta/domain/quality.ts"
import type { ProcessHandle } from "../../src/meta/ports.ts"
import { mockPorts, mockProcessHandle, mockPackage } from "./mocks.ts"

/** Mock process handle that emits stdout lines before resolving. */
function mockProcessWithOutput(exitCode: number, stdoutLines: string[]): ProcessHandle {
  const listeners: Record<string, ((line: string) => void)[]> = {}
  return {
    onLine(stream: "stdout" | "stderr", cb: (line: string) => void) {
      ;(listeners[stream] ??= []).push(cb)
    },
    wait() {
      for (const line of stdoutLines) {
        for (const cb of listeners["stdout"] ?? []) cb(line)
      }
      return Promise.resolve(exitCode)
    },
  }
}

describe("isLintable", () => {
  it("accepts .ts files", () => {
    expect(isLintable("apps/control/src/index.ts")).toBe(true)
  })

  it("accepts .tsx files", () => {
    expect(isLintable("apps/web/src/App.tsx")).toBe(true)
  })

  it("rejects .md files", () => {
    expect(isLintable("CLAUDE.md")).toBe(false)
  })

  it("rejects .json files", () => {
    expect(isLintable("package.json")).toBe(false)
  })

  it("rejects .d.ts files", () => {
    expect(isLintable("lib/types/index.d.ts")).toBe(false)
  })

  it("rejects node_modules", () => {
    expect(isLintable("node_modules/foo/index.ts")).toBe(false)
  })

  it("rejects dist", () => {
    expect(isLintable("apps/control/dist/index.ts")).toBe(false)
  })
})

describe("isFormattable", () => {
  it("accepts .ts files", () => {
    expect(isFormattable("src/index.ts")).toBe(true)
  })

  it("accepts .md files", () => {
    expect(isFormattable("CLAUDE.md")).toBe(true)
  })

  it("accepts .json files", () => {
    expect(isFormattable("package.json")).toBe(true)
  })

  it("accepts .css files", () => {
    expect(isFormattable("styles/app.css")).toBe(true)
  })

  it("accepts .yaml files", () => {
    expect(isFormattable("config.yaml")).toBe(true)
  })

  it("rejects .png files", () => {
    expect(isFormattable("logo.png")).toBe(false)
  })

  it("rejects node_modules", () => {
    expect(isFormattable("node_modules/foo/package.json")).toBe(false)
  })

  it("rejects .d.ts files", () => {
    expect(isFormattable("lib/types/index.d.ts")).toBe(false)
  })
})

describe("isTypecheckable", () => {
  it("accepts .ts files", () => {
    expect(isTypecheckable("src/index.ts")).toBe(true)
  })

  it("accepts .tsx files", () => {
    expect(isTypecheckable("src/App.tsx")).toBe(true)
  })

  it("rejects .md files", () => {
    expect(isTypecheckable("CLAUDE.md")).toBe(false)
  })

  it("rejects .d.ts files", () => {
    expect(isTypecheckable("lib/types/index.d.ts")).toBe(false)
  })
})

describe("checkQuality", () => {
  it("returns passed with no checks for non-code files", async () => {
    const ports = mockPorts()
    const result = await checkQuality(ports, ["CLAUDE.md", "README.md"])

    // .md files are formattable, so prettier runs
    expect(result.checks.length).toBe(1)
    expect(result.checks[0]!.name).toContain("prettier")
  })

  it("skips all gates for unrecognized extensions", async () => {
    const ports = mockPorts()
    const result = await checkQuality(ports, ["logo.png", "photo.jpg"])

    expect(result.passed).toBe(true)
    expect(result.checks).toEqual([])
  })

  it("runs eslint --fix and prettier --write for .ts files", async () => {
    const spawned: string[][] = []
    const ports = mockPorts({
      process: {
        spawn({ cmd, args }: { cmd: string; args: string[] }) {
          spawned.push([cmd, ...args])
          return mockProcessHandle(0)
        },
      },
    })

    await checkQuality(ports, ["apps/control/src/index.ts"])

    const eslintCall = spawned.find((s) => s[0] === "bunx" && s[1] === "eslint")
    const prettierCall = spawned.find((s) => s[0] === "bunx" && s[1] === "prettier")
    expect(eslintCall).toBeDefined()
    expect(eslintCall).toContain("--fix")
    expect(prettierCall).toBeDefined()
    expect(prettierCall).toContain("--write")
  })

  it("does not run typecheck for .md-only commits", async () => {
    const spawned: string[] = []
    const ports = mockPorts({
      process: {
        spawn({ cmd, args }: { cmd: string; args: string[] }) {
          spawned.push(`${cmd} ${args[0]}`)
          return mockProcessHandle(0)
        },
      },
    })

    await checkQuality(ports, ["CLAUDE.md"])

    expect(spawned).not.toContain("bun run")
  })

  it("reports failure when eslint exits non-zero", async () => {
    const ports = mockPorts({
      process: {
        spawn({ cmd, args }: { cmd: string; args: string[] }) {
          const isEslint = cmd === "bunx" && args[0] === "eslint"
          return mockProcessHandle(isEslint ? 1 : 0)
        },
      },
    })

    const result = await checkQuality(ports, ["apps/control/src/bad.ts"])

    expect(result.passed).toBe(false)
    expect(result.checks.some((c: { status: string }) => c.status === "fail")).toBe(true)
  })

  it("runs typecheck for affected packages with ts files", async () => {
    const spawned: Array<{ cmd: string; args: string[]; cwd: string }> = []
    const pkg = mockPackage()

    const ports = mockPorts({
      fs: {
        exists: () => true,
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: ["apps/*"] })
          if (path === "/repo/apps/pkg/package.json")
            return JSON.stringify({ name: "@test/pkg", scripts: { typecheck: "tsc --noEmit" } })
          return "{}"
        },
        writeFile: () => {},
        readDir: (path: string) => {
          if (path === "/repo/apps") return [{ name: "pkg", isDirectory: true }]
          return []
        },
        unlink: () => {},
        mkdir: () => {},
      },
      process: {
        spawn(params: { cmd: string; args: string[]; cwd: string }) {
          spawned.push(params)
          return mockProcessHandle(0)
        },
      },
    })

    await checkQuality(ports, ["apps/pkg/src/index.ts"])

    const typecheckCalls = spawned.filter((s) => s.cmd === "bun" && s.args[0] === "run" && s.args[1] === "typecheck")
    expect(typecheckCalls.length).toBe(1)
    expect(typecheckCalls[0]!.cwd).toBe(pkg.dir)
  })

  it("typecheck passes when errors are only in non-committed files", async () => {
    const ports = mockPorts({
      fs: {
        exists: () => true,
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: ["apps/*"] })
          if (path === "/repo/apps/pkg/package.json")
            return JSON.stringify({ name: "@test/pkg", scripts: { typecheck: "tsc --noEmit" } })
          return "{}"
        },
        writeFile: () => {},
        readDir: (path: string) => {
          if (path === "/repo/apps") return [{ name: "pkg", isDirectory: true }]
          return []
        },
        unlink: () => {},
        mkdir: () => {},
      },
      process: {
        spawn({ cmd, args }: { cmd: string; args: string[] }) {
          const isTypecheck = cmd === "bun" && args[0] === "run" && args[1] === "typecheck"
          if (isTypecheck) {
            return mockProcessWithOutput(2, [
              "src/other-file.ts(1,10): error TS2307: Cannot find module 'foo'.",
              "src/other-file.ts(5,3): error TS2339: Property 'bar' does not exist.",
            ])
          }
          return mockProcessHandle(0)
        },
      },
    })

    const result = await checkQuality(ports, ["apps/pkg/src/index.ts"])
    const tc = result.checks.find((c) => c.name.startsWith("typecheck"))
    expect(tc).toBeDefined()
    expect(tc!.status).toBe("pass")
  })

  it("typecheck fails when errors are in committed files", async () => {
    const ports = mockPorts({
      fs: {
        exists: () => true,
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: ["apps/*"] })
          if (path === "/repo/apps/pkg/package.json")
            return JSON.stringify({ name: "@test/pkg", scripts: { typecheck: "tsc --noEmit" } })
          return "{}"
        },
        writeFile: () => {},
        readDir: (path: string) => {
          if (path === "/repo/apps") return [{ name: "pkg", isDirectory: true }]
          return []
        },
        unlink: () => {},
        mkdir: () => {},
      },
      process: {
        spawn({ cmd, args }: { cmd: string; args: string[] }) {
          const isTypecheck = cmd === "bun" && args[0] === "run" && args[1] === "typecheck"
          if (isTypecheck) {
            return mockProcessWithOutput(2, ["src/index.ts(1,10): error TS2307: Cannot find module 'foo'."])
          }
          return mockProcessHandle(0)
        },
      },
    })

    const result = await checkQuality(ports, ["apps/pkg/src/index.ts"])
    const tc = result.checks.find((c) => c.name.startsWith("typecheck"))
    expect(tc).toBeDefined()
    expect(tc!.status).toBe("fail")
    expect(tc!.output).toContain("src/index.ts")
  })

  it("typecheck reports only errors in committed files when mixed", async () => {
    const ports = mockPorts({
      fs: {
        exists: () => true,
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: ["apps/*"] })
          if (path === "/repo/apps/pkg/package.json")
            return JSON.stringify({ name: "@test/pkg", scripts: { typecheck: "tsc --noEmit" } })
          return "{}"
        },
        writeFile: () => {},
        readDir: (path: string) => {
          if (path === "/repo/apps") return [{ name: "pkg", isDirectory: true }]
          return []
        },
        unlink: () => {},
        mkdir: () => {},
      },
      process: {
        spawn({ cmd, args }: { cmd: string; args: string[] }) {
          const isTypecheck = cmd === "bun" && args[0] === "run" && args[1] === "typecheck"
          if (isTypecheck) {
            return mockProcessWithOutput(2, [
              "src/index.ts(3,5): error TS2322: Type 'string' is not assignable.",
              "src/other.ts(1,1): error TS2307: Cannot find module 'missing'.",
              "src/index.ts(10,1): error TS2304: Cannot find name 'foo'.",
            ])
          }
          return mockProcessHandle(0)
        },
      },
    })

    const result = await checkQuality(ports, ["apps/pkg/src/index.ts"])
    const tc = result.checks.find((c) => c.name.startsWith("typecheck"))
    expect(tc!.status).toBe("fail")
    expect(tc!.output).toContain("src/index.ts(3,5)")
    expect(tc!.output).toContain("src/index.ts(10,1)")
    expect(tc!.output).not.toContain("src/other.ts")
  })
})
