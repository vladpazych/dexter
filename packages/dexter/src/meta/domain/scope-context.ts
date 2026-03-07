/**
 * Scope utilities — resolve CLAUDE.md cascade from scope strings.
 */

import { join } from "node:path"

import type { ControlPorts } from "../ports.ts"

/**
 * Extract the directory prefix from a scope string.
 *
 * - File path: strip filename → directory
 * - Glob: extract non-glob prefix
 * - Directory: as-is (strip trailing slash)
 */
export function scopeToDir(scope: string): string {
  // Strip trailing slash for consistency
  const clean = scope.replace(/\/+$/, "")

  // Glob: take directory prefix before first glob character
  if (/[*?{]/.test(clean)) {
    const idx = clean.search(/[*?{]/)
    const prefix = clean.slice(0, idx).replace(/\/+$/, "")
    return prefix || "."
  }

  // File: if last segment has a dot, treat as file → strip to parent
  const lastSlash = clean.lastIndexOf("/")
  const lastSegment = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean
  if (lastSegment.includes(".")) {
    return lastSlash >= 0 ? clean.slice(0, lastSlash) : "."
  }

  return clean || "."
}

/**
 * Walk from root to target directory, collecting CLAUDE.md paths that exist.
 * Returns @-prefixed references in cascade order: root first, most specific last.
 */
export function resolveCascade(ports: ControlPorts, dir: string): string[] {
  const refs: string[] = []

  // Always check root CLAUDE.md
  if (ports.fs.exists(join(ports.root, "CLAUDE.md"))) {
    refs.push("@CLAUDE.md")
  }

  // Walk each segment of the directory path
  if (dir !== ".") {
    const segments = dir.split("/").filter(Boolean)
    let current = ""

    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment
      if (ports.fs.exists(join(ports.root, current, "CLAUDE.md"))) {
        refs.push(`@${current}/CLAUDE.md`)
      }
    }
  }

  return refs
}
