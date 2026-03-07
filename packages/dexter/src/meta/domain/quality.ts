/**
 * Quality gates — auto-fix then gate before commit.
 *
 * Prettier and ESLint run in fix mode (deterministic, always safe).
 * Typecheck is gate-only (no auto-fix possible).
 */

import { join, relative } from "node:path"

import type { ControlPorts } from "../ports.ts"
import type { Package, QualityCheck, QualityResult } from "../types.ts"

import { discoverPackages, filterByFiles } from "./workspace.ts"

const SKIP_PATTERNS = ["node_modules/", "dist/", ".next/", "coverage/", ".d.ts", "routeTree.gen.ts"]

const LINT_EXTS = [".ts", ".tsx"]
const FORMAT_EXTS = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".html", ".yaml", ".yml"]
const TYPECHECK_EXTS = [".ts", ".tsx"]

function hasExt(file: string, exts: string[]): boolean {
  return exts.some((ext) => file.endsWith(ext))
}

function isSkipped(file: string): boolean {
  return SKIP_PATTERNS.some((p) => file.includes(p))
}

export function isLintable(file: string): boolean {
  return hasExt(file, LINT_EXTS) && !isSkipped(file)
}

export function isFormattable(file: string): boolean {
  return hasExt(file, FORMAT_EXTS) && !isSkipped(file)
}

export function isTypecheckable(file: string): boolean {
  return hasExt(file, TYPECHECK_EXTS) && !isSkipped(file)
}

function collectOutput(ports: ControlPorts, cmd: string, args: string[], cwd: string): Promise<QualityCheck> {
  return new Promise((resolve) => {
    const lines: string[] = []
    const handle = ports.process.spawn({ cmd, args, cwd })

    handle.onLine("stdout", (line) => lines.push(line))
    handle.onLine("stderr", (line) => lines.push(line))

    handle.wait().then((code) => {
      resolve({
        name: `${cmd} ${args[0] ?? ""}`.trim(),
        status: code === 0 ? "pass" : "fail",
        output: lines.join("\n"),
      })
    })
  })
}

function scopedTypecheck(ports: ControlPorts, pkg: Package, committedFiles: string[]): Promise<QualityCheck> {
  return new Promise((resolve) => {
    const lines: string[] = []
    const handle = ports.process.spawn({ cmd: "bun", args: ["run", "typecheck"], cwd: pkg.dir })

    handle.onLine("stdout", (line) => lines.push(line))
    handle.onLine("stderr", (line) => lines.push(line))

    handle.wait().then((code) => {
      const name = `typecheck (${pkg.shortName})`

      if (code === 0) {
        resolve({ name, status: "pass", output: "" })
        return
      }

      // Filter to errors in committed files only
      const relFiles = committedFiles
        .filter((f) => f.startsWith(pkg.relDir + "/"))
        .map((f) => f.slice(pkg.relDir.length + 1))

      const relevant = lines.filter((line) => relFiles.some((f) => line.startsWith(f + "(")))

      resolve({
        name,
        status: relevant.length > 0 ? "fail" : "pass",
        output: relevant.join("\n"),
      })
    })
  })
}

export async function checkQuality(ports: ControlPorts, files: string[]): Promise<QualityResult> {
  const checks: Promise<QualityCheck>[] = []

  const existing = files.filter((f) => ports.fs.exists(join(ports.root, f)))
  const lintFiles = existing.filter(isLintable)
  const formatFiles = existing.filter(isFormattable)

  const packages = discoverPackages(ports)

  // ESLint on lintable files — package-aware routing
  if (lintFiles.length > 0) {
    const lintAffected = filterByFiles(packages, lintFiles, ports.root)
    const pkgWithConfig = lintAffected.filter((pkg) => ports.fs.exists(join(pkg.dir, "eslint.config.js")))
    const pkgFiles = new Set<string>()

    for (const pkg of pkgWithConfig) {
      const pkgSpecific = lintFiles.filter((f) => f.startsWith(pkg.relDir + "/"))
      for (const f of pkgSpecific) pkgFiles.add(f)
      if (pkgSpecific.length > 0) {
        const relFiles = pkgSpecific.map((f) => relative(pkg.relDir, f))
        checks.push(collectOutput(ports, "bunx", ["eslint", "--fix", "--no-warn-ignored", ...relFiles], pkg.dir))
      }
    }

    const rootLintFiles = lintFiles.filter((f) => !pkgFiles.has(f))
    if (rootLintFiles.length > 0) {
      checks.push(collectOutput(ports, "bunx", ["eslint", "--fix", "--no-warn-ignored", ...rootLintFiles], ports.root))
    }
  }

  // Prettier on all formattable files
  if (formatFiles.length > 0) {
    checks.push(collectOutput(ports, "bunx", ["prettier", "--write", ...formatFiles], ports.root))
  }

  // Typecheck per affected package — scoped to committed files only
  const tsFiles = existing.filter(isTypecheckable)
  if (tsFiles.length > 0) {
    const affected = filterByFiles(packages, tsFiles, ports.root)
    for (const pkg of affected) {
      if ("typecheck" in pkg.scripts) {
        checks.push(scopedTypecheck(ports, pkg, tsFiles))
      }
    }
  }

  if (checks.length === 0) {
    return { passed: true, checks: [] }
  }

  const results = await Promise.all(checks)
  const passed = results.every((c) => c.status === "pass")

  return { passed, checks: results }
}
