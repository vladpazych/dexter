/**
 * Repo tooling test mocks.
 *
 * Mock ports for testing without I/O.
 */

import type { WorkspacePackage } from "../../src/meta/domain/workspace.ts"
import type { FsPort, ProcessHandle, RepoPorts } from "../../src/meta/ports.ts"

export function mockProcessHandle(exitCode: number = 0): ProcessHandle {
  const listeners: Record<string, ((line: string) => void)[]> = {}
  return {
    onLine(stream: "stdout" | "stderr", cb: (line: string) => void) {
      ;(listeners[stream] ??= []).push(cb)
    },
    wait: () => Promise.resolve(exitCode),
  }
}

export function mockPorts(overrides: Partial<RepoPorts> = {}): RepoPorts {
  return {
    root: "/repo",
    tmpdir: () => "/tmp",
    git: {
      run: () => ({ success: true, stdout: "", stderr: "" }),
      checkIgnore: () => false,
    },
    fs: {
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
    },
    process: {
      spawn: () => mockProcessHandle(0),
    },
    glob: {
      match: (pattern: string, candidates: string[]) =>
        candidates.filter((c: string) => c.includes(pattern.replace("**", ""))),
    },
    ...overrides,
  }
}

export function mockPackage(overrides: Partial<WorkspacePackage> = {}): WorkspacePackage {
  return {
    name: "@test/pkg",
    shortName: "pkg",
    dir: "/repo/apps/pkg",
    relDir: "apps/pkg",
    scripts: { typecheck: "tsc --noEmit" },
    ...overrides,
  }
}

// === Workspace fixture ===

type DirEntry = { name: string; isDirectory: boolean }

/**
 * Standard workspace fixture for tests that call discoverPackages.
 * Returns files/dirs + an FsPort that resolves them.
 */
export function createWorkspaceFs(root = "/repo"): FsPort {
  const files: Record<string, string> = {
    [`${root}/package.json`]: JSON.stringify({ workspaces: ["apps/*", "lib/*"] }),
    [`${root}/apps/control/package.json`]: JSON.stringify({
      name: "@asombro/control",
      scripts: { build: "bun build", typecheck: "tsc --noEmit", test: "bun test test/" },
    }),
    [`${root}/apps/web/package.json`]: JSON.stringify({
      name: "@asombro/web",
      scripts: { dev: "vite", typecheck: "tsc --noEmit" },
    }),
    [`${root}/lib/reel/package.json`]: JSON.stringify({
      name: "@asombro/reel",
      scripts: { test: "bun test", typecheck: "tsc --noEmit" },
    }),
  }

  const dirs: Record<string, DirEntry[]> = {
    [`${root}/apps`]: [
      { name: "control", isDirectory: true },
      { name: "web", isDirectory: true },
    ],
    [`${root}/lib`]: [{ name: "reel", isDirectory: true }],
  }

  return {
    exists: (path: string) => path in files,
    readFile: (path: string) => {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`)
      return files[path]!
    },
    writeFile: () => {},
    readBytes: (path: string) => {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`)
      return new TextEncoder().encode(files[path]!)
    },
    writeBytes: () => {},
    readDir: (path: string) => {
      if (!(path in dirs)) throw new Error(`ENOENT: ${path}`)
      return dirs[path]!
    },
    unlink: () => {},
    rmdir: () => {},
    mkdir: () => {},
    rename: () => {},
  }
}
