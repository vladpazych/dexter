/**
 * Query: lint — ESLint results for given scopes.
 */

import { join, relative } from "node:path"

import type { ControlPorts } from "../ports.ts"
import type { QueryResult } from "../types.ts"
import { isLintable } from "./quality.ts"
import { discoverPackages, filterByFiles } from "./workspace.ts"
import { extractErrors } from "./format.ts"

export async function lint(ports: ControlPorts, scopes: string[], opts?: { changed?: boolean }): Promise<QueryResult> {
  const effectiveScopes = scopes.length === 0 ? ["."] : scopes
  const allFiles = opts?.changed ? getChangedFiles(ports, effectiveScopes) : getTrackedFiles(ports, effectiveScopes)

  if (allFiles.length === 0) {
    return { what: "lint", scopes, data: { errorCount: 0, errors: [], raw: "" } }
  }

  const packages = discoverPackages(ports)
  const affected = filterByFiles(packages, allFiles, ports.root)
  const pkgWithOwnConfig = affected.filter((pkg) => ports.fs.exists(join(pkg.dir, "eslint.config.js")))

  const pkgFiles = new Set<string>()
  const lintJobs: Promise<string>[] = []

  for (const pkg of pkgWithOwnConfig) {
    const pkgSpecific = allFiles.filter((f) => f.startsWith(pkg.relDir + "/"))
    for (const f of pkgSpecific) pkgFiles.add(f)
    if (pkgSpecific.length > 0) {
      const relFiles = pkgSpecific.map((f) => relative(pkg.relDir, f))
      lintJobs.push(runEslint(ports, relFiles, pkg.dir))
    }
  }

  const rootFiles = allFiles.filter((f) => !pkgFiles.has(f))
  if (rootFiles.length > 0) {
    lintJobs.push(runEslint(ports, rootFiles, ports.root))
  }

  const outputs = await Promise.all(lintJobs)
  const raw = outputs.filter(Boolean).join("\n")

  return { what: "lint", scopes, data: extractErrors(raw) }
}

function getTrackedFiles(ports: ControlPorts, scopes: string[]): string[] {
  const files: string[] = []
  for (const scope of scopes) {
    const lsResult = ports.git.run(["ls-files", scope])
    if (lsResult.success && lsResult.stdout) {
      files.push(
        ...lsResult.stdout
          .split("\n")
          .filter(Boolean)
          .filter(isLintable)
          .filter((f) => ports.fs.exists(join(ports.root, f))),
      )
    }
  }
  return files
}

function getChangedFiles(ports: ControlPorts, scopes: string[]): string[] {
  const files: string[] = []
  for (const scope of scopes) {
    const modified = ports.git.run(["diff", "--name-only", "HEAD", "--", scope])
    if (modified.success) files.push(...modified.stdout.split("\n").filter(Boolean))
    const untracked = ports.git.run(["ls-files", "--others", "--exclude-standard", "--", scope])
    if (untracked.success) files.push(...untracked.stdout.split("\n").filter(Boolean))
  }
  return [...new Set(files)].filter(isLintable).filter((f) => ports.fs.exists(join(ports.root, f)))
}

function runEslint(ports: ControlPorts, files: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    const lines: string[] = []
    const handle = ports.process.spawn({
      cmd: "bunx",
      args: ["eslint", "--no-warn-ignored", ...files],
      cwd,
    })
    handle.onLine("stdout", (line) => lines.push(line))
    handle.onLine("stderr", (line) => lines.push(line))
    handle.wait().then(() => resolve(lines.join("\n")))
  })
}
