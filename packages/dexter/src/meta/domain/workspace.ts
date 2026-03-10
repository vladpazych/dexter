/**
 * Workspace discovery — reads package.json workspaces globs and builds package metadata.
 */

import { basename, join, relative } from "node:path"

import type { RepoPorts } from "../ports.ts"

export type WorkspacePackage = {
  name: string
  shortName: string
  dir: string
  relDir: string
  scripts: Record<string, string>
}

/**
 * Discover all workspace packages from root package.json.
 * Supports `prefix/*` globs (e.g. "apps/*", "lib/*") and bare directories (e.g. "meta").
 */
export function discoverPackages(ports: RepoPorts): WorkspacePackage[] {
  const rootPkg = JSON.parse(ports.fs.readFile(join(ports.root, "package.json"))) as {
    workspaces?: string[]
  }

  const globs = rootPkg.workspaces ?? []
  const packages: WorkspacePackage[] = []

  for (const glob of globs) {
    if (glob.endsWith("/*")) {
      // Glob: enumerate subdirectories
      const prefix = glob.slice(0, -2)
      const prefixDir = join(ports.root, prefix)

      let entries: Array<{ name: string; isDirectory: boolean }>
      try {
        entries = ports.fs.readDir(prefixDir).filter((d) => d.isDirectory)
      } catch {
        continue
      }

      for (const entry of entries.map((d) => d.name).sort()) {
        const pkg = readPackage(ports, join(prefixDir, entry))
        if (pkg) packages.push(pkg)
      }
    } else if (!glob.includes("*")) {
      // Bare directory: single package (skip unsupported globs like "packages/**")
      const pkg = readPackage(ports, join(ports.root, glob))
      if (pkg) packages.push(pkg)
    }
  }

  return packages.sort((a, b) => a.relDir.localeCompare(b.relDir))
}

function readPackage(ports: RepoPorts, dir: string): WorkspacePackage | null {
  try {
    const pkg = JSON.parse(ports.fs.readFile(join(dir, "package.json"))) as {
      name?: string
      scripts?: Record<string, string>
    }
    return {
      name: pkg.name ?? basename(dir),
      shortName: basename(dir),
      dir,
      relDir: relative(ports.root, dir),
      scripts: pkg.scripts ?? {},
    }
  } catch {
    return null
  }
}

export function filterByScope(packages: WorkspacePackage[], scope: string): WorkspacePackage[] {
  return packages.filter((p) => p.relDir.startsWith(scope))
}

export function filterByScript(packages: WorkspacePackage[], script: string): WorkspacePackage[] {
  return packages.filter((p) => script in p.scripts)
}

export function filterByFiles(packages: WorkspacePackage[], files: string[], root: string): WorkspacePackage[] {
  const relFiles = files.map((f) => (f.startsWith("/") ? relative(root, f) : f))
  return packages.filter((pkg) => relFiles.some((f) => f.startsWith(pkg.relDir + "/")))
}
