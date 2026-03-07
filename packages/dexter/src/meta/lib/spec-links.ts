/**
 * Spec link validation.
 *
 * Validates markdown links [text](path.md) in CLAUDE.md and .md files.
 *
 * Paths resolve as:
 * - /path/file.md   Root-absolute (from repo root)
 * - ./path/file.md  Relative (from file's directory)
 * - path/file.md    Relative (from file's directory)
 */

import { existsSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"

export type SpecLink = {
  type: "link"
  path: string
  line: number
}

export type BrokenLink = SpecLink & {
  resolved: string
}

/** Check if a file participates in the spec system */
export function isSpecFile(filePath: string): boolean {
  if (basename(filePath) === "CLAUDE.md") return true
  if (filePath.endsWith(".md")) return true
  return false
}

/** Extract markdown links to .md files */
export function extractSpecLinks(content: string): SpecLink[] {
  const links: SpecLink[] = []
  const lines = content.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineNum = i + 1

    const linkRegex = /\[[^\]]*\]\(([^)]+\.md)\)/g
    let match
    while ((match = linkRegex.exec(line)) !== null) {
      const path = match[1]!
      if (path.startsWith("http://") || path.startsWith("https://")) continue
      links.push({ type: "link", path, line: lineNum })
    }
  }

  return links
}

/** Resolve a spec link path to absolute filesystem path */
export function resolveSpecPath(linkPath: string, fromFile: string, repoRoot: string): string {
  if (linkPath.startsWith("/")) {
    return join(repoRoot, linkPath)
  }
  return resolve(dirname(fromFile), linkPath)
}

/** Find all broken links in a spec file */
export function findBrokenLinks(filePath: string, content: string, repoRoot: string): BrokenLink[] {
  const links = extractSpecLinks(content)
  const broken: BrokenLink[] = []

  for (const link of links) {
    const resolved = resolveSpecPath(link.path, filePath, repoRoot)
    if (!existsSync(resolved)) {
      broken.push({ ...link, resolved })
    }
  }

  return broken
}

/** Format broken links for hook context output */
export function formatBrokenLinks(broken: BrokenLink[]): string {
  const lines = ["=== Broken Spec Links ==="]
  for (const link of broken) {
    lines.push(`Warning: [...](${link.path}) -> not found (line ${link.line})`)
  }
  return lines.join("\n")
}
