/**
 * Workspace Discovery Tests
 *
 * Tests package discovery from workspace globs and filtering functions.
 */

import { describe, expect, it } from "bun:test"

import { discoverPackages, filterByFiles, filterByScope, filterByScript } from "../../../src/meta/domain/workspace.ts"
import { mockPorts, createWorkspaceFs } from "../mocks.ts"

function workspacePorts(root = "/repo") {
  return mockPorts({ fs: createWorkspaceFs(root), root })
}

function createFsStub(overrides: Partial<ReturnType<typeof createWorkspaceFs>>) {
  return {
    exists: () => true,
    readFile: () => "{}",
    writeFile: () => {},
    readBytes: () => new Uint8Array(),
    writeBytes: () => {},
    readDir: () => [],
    unlink: () => {},
    rmdir: () => {},
    mkdir: () => {},
    rename: () => {},
    ...overrides,
  }
}

describe("discoverPackages", () => {
  it("discovers packages from workspaces globs", () => {
    const ports = workspacePorts()
    const packages = discoverPackages(ports)

    expect(packages.length).toBe(3)
    const names = packages.map((p) => p.name)
    expect(names).toContain("@asombro/control")
    expect(names).toContain("@asombro/web")
    expect(names).toContain("@asombro/reel")
  })

  it("sorts packages by relDir", () => {
    const ports = workspacePorts()
    const packages = discoverPackages(ports)
    const relDirs = packages.map((p) => p.relDir)

    expect(relDirs).toEqual([...relDirs].sort())
  })

  it("builds correct Package shape", () => {
    const ports = workspacePorts()
    const packages = discoverPackages(ports)
    const control = packages.find((p) => p.shortName === "control")!

    expect(control.name).toBe("@asombro/control")
    expect(control.shortName).toBe("control")
    expect(control.dir).toBe("/repo/apps/control")
    expect(control.relDir).toBe("apps/control")
    expect(control.scripts).toHaveProperty("typecheck")
  })

  it("skips unsupported glob patterns like packages/**", () => {
    const ports = mockPorts({
      fs: createFsStub({
        exists: () => true,
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: ["packages/**"] })
          return "{}"
        },
      }),
    })

    const packages = discoverPackages(ports)
    expect(packages).toEqual([])
  })

  it("discovers bare directory workspace entries", () => {
    const ports = mockPorts({
      fs: createFsStub({
        exists: () => true,
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: ["apps/*", "meta"] })
          if (path === "/repo/apps/web/package.json")
            return JSON.stringify({ name: "@test/web", scripts: { dev: "vite" } })
          if (path === "/repo/meta/package.json")
            return JSON.stringify({ name: "@test/meta", scripts: { typecheck: "tsc --noEmit" } })
          throw new Error("ENOENT")
        },
        writeFile: () => {},
        readDir: (path: string) => {
          if (path === "/repo/apps") return [{ name: "web", isDirectory: true }]
          throw new Error("ENOENT")
        },
      }),
    })

    const packages = discoverPackages(ports)
    expect(packages.length).toBe(2)

    const meta = packages.find((p) => p.shortName === "meta")!
    expect(meta.name).toBe("@test/meta")
    expect(meta.relDir).toBe("meta")
    expect(meta.scripts).toHaveProperty("typecheck")
  })

  it("skips directories without package.json", () => {
    const ports = mockPorts({
      fs: createFsStub({
        exists: () => true,
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: ["apps/*"] })
          if (path === "/repo/apps/good/package.json") return JSON.stringify({ name: "@test/good" })
          throw new Error("ENOENT")
        },
        writeFile: () => {},
        readDir: (path: string) => {
          if (path === "/repo/apps")
            return [
              { name: "good", isDirectory: true },
              { name: "bad", isDirectory: true },
            ]
          return []
        },
      }),
    })

    const packages = discoverPackages(ports)
    expect(packages.length).toBe(1)
    expect(packages[0]!.name).toBe("@test/good")
  })

  it("skips non-directory entries", () => {
    const ports = mockPorts({
      fs: createFsStub({
        exists: () => true,
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: ["apps/*"] })
          if (path === "/repo/apps/real/package.json") return JSON.stringify({ name: "@test/real" })
          return "{}"
        },
        writeFile: () => {},
        readDir: (path: string) => {
          if (path === "/repo/apps")
            return [
              { name: "real", isDirectory: true },
              { name: "README.md", isDirectory: false },
            ]
          return []
        },
      }),
    })

    const packages = discoverPackages(ports)
    expect(packages.length).toBe(1)
  })

  it("skips missing prefix directories", () => {
    const ports = mockPorts({
      fs: createFsStub({
        exists: () => true,
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: ["apps/*", "missing/*"] })
          return "{}"
        },
        readDir: (path: string) => {
          if (path === "/repo/apps") return []
          throw new Error("ENOENT")
        },
      }),
    })

    const packages = discoverPackages(ports)
    expect(packages).toEqual([])
  })

  it("falls back to directory name when package.json has no name", () => {
    const ports = mockPorts({
      fs: createFsStub({
        exists: () => true,
        readFile: (path: string) => {
          if (path === "/repo/package.json") return JSON.stringify({ workspaces: ["apps/*"] })
          if (path === "/repo/apps/unnamed/package.json") return JSON.stringify({ scripts: {} })
          return "{}"
        },
        readDir: (path: string) => {
          if (path === "/repo/apps") return [{ name: "unnamed", isDirectory: true }]
          return []
        },
      }),
    })

    const packages = discoverPackages(ports)
    expect(packages[0]!.name).toBe("unnamed")
    expect(packages[0]!.shortName).toBe("unnamed")
  })

  it("returns empty array when no workspaces defined", () => {
    const ports = mockPorts({
      fs: createFsStub({
        exists: () => true,
        readFile: () => JSON.stringify({}),
      }),
    })

    const packages = discoverPackages(ports)
    expect(packages).toEqual([])
  })
})

describe("filterByScope", () => {
  it("filters packages by relDir prefix", () => {
    const ports = workspacePorts()
    const packages = discoverPackages(ports)
    const apps = filterByScope(packages, "apps")

    expect(apps.length).toBe(2)
    expect(apps.every((p) => p.relDir.startsWith("apps"))).toBe(true)
  })

  it("returns empty array for non-matching scope", () => {
    const ports = workspacePorts()
    const packages = discoverPackages(ports)
    const none = filterByScope(packages, "tools")

    expect(none).toEqual([])
  })
})

describe("filterByScript", () => {
  it("returns only packages with the specified script", () => {
    const ports = workspacePorts()
    const packages = discoverPackages(ports)
    const withTest = filterByScript(packages, "test")

    expect(withTest.length).toBe(2)
    expect(withTest.map((p) => p.shortName).sort()).toEqual(["control", "reel"])
  })

  it("returns empty array when no package has script", () => {
    const ports = workspacePorts()
    const packages = discoverPackages(ports)
    const none = filterByScript(packages, "deploy")

    expect(none).toEqual([])
  })
})

describe("filterByFiles", () => {
  it("returns packages that contain any of the files", () => {
    const ports = workspacePorts()
    const packages = discoverPackages(ports)
    const matched = filterByFiles(packages, ["apps/control/src/index.ts"], "/repo")

    expect(matched.length).toBe(1)
    expect(matched[0]!.shortName).toBe("control")
  })

  it("converts absolute paths to relative using root", () => {
    const ports = workspacePorts()
    const packages = discoverPackages(ports)
    const matched = filterByFiles(packages, ["/repo/lib/reel/src/types.ts"], "/repo")

    expect(matched.length).toBe(1)
    expect(matched[0]!.shortName).toBe("reel")
  })

  it("matches multiple packages from file list", () => {
    const ports = workspacePorts()
    const packages = discoverPackages(ports)
    const matched = filterByFiles(packages, ["apps/control/src/index.ts", "lib/reel/src/types.ts"], "/repo")

    expect(matched.length).toBe(2)
  })

  it("returns empty array for unrelated files", () => {
    const ports = workspacePorts()
    const packages = discoverPackages(ports)
    const matched = filterByFiles(packages, ["README.md", ".gitignore"], "/repo")

    expect(matched).toEqual([])
  })
})
