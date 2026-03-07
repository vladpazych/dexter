/**
 * Git blame — structured per-line attribution with range grouping.
 */

import type { ControlPorts } from "../ports.ts"
import type { BlameRange, GitResult } from "../types.ts"
import { ControlError } from "../errors.ts"

type PorcelainEntry = {
  commit: string
  author: string
  date: string
  message: string
  line: number
  content: string
}

/** Parse git blame --line-porcelain output into individual entries. */
function parsePorcelain(raw: string): PorcelainEntry[] {
  const entries: PorcelainEntry[] = []
  const lines = raw.split("\n")
  let i = 0

  while (i < lines.length) {
    const header = lines[i]!
    const match = header.match(/^([0-9a-f]{40})\s+\d+\s+(\d+)/)
    if (!match) {
      i++
      continue
    }

    const commit = match[1]!.slice(0, 8)
    const line = parseInt(match[2]!, 10)
    let author = ""
    let date = ""
    let message = ""
    let content = ""

    i++
    while (i < lines.length) {
      const cur = lines[i]!
      if (cur.startsWith("\t")) {
        content = cur.slice(1)
        i++
        break
      }
      if (cur.startsWith("author ")) author = cur.slice(7)
      else if (cur.startsWith("author-time ")) {
        const ts = parseInt(cur.slice(12), 10)
        date = new Date(ts * 1000).toISOString().slice(0, 10)
      } else if (cur.startsWith("summary ")) message = cur.slice(8)
      i++
    }

    entries.push({ commit, author, date, message, line, content })
  }

  return entries
}

/** Group consecutive entries from the same commit into ranges. */
function groupRanges(entries: PorcelainEntry[]): BlameRange[] {
  if (entries.length === 0) return []

  const ranges: BlameRange[] = []
  let current: BlameRange = {
    commit: entries[0]!.commit,
    author: entries[0]!.author,
    date: entries[0]!.date,
    message: entries[0]!.message,
    startLine: entries[0]!.line,
    endLine: entries[0]!.line,
    content: [entries[0]!.content],
  }

  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i]!
    if (entry.commit === current.commit && entry.line === current.endLine + 1) {
      current.endLine = entry.line
      current.content.push(entry.content)
    } else {
      ranges.push(current)
      current = {
        commit: entry.commit,
        author: entry.author,
        date: entry.date,
        message: entry.message,
        startLine: entry.line,
        endLine: entry.line,
        content: [entry.content],
      }
    }
  }
  ranges.push(current)
  return ranges
}

export function blame(ports: ControlPorts, file: string, lines?: [number, number]): GitResult {
  const fullPath = `${ports.root}/${file}`
  if (!ports.fs.exists(fullPath)) {
    throw new ControlError("file_not_found", `file not found: ${file}`, [
      "Provide a path relative to repo root",
      "Example: blame meta/src/types.ts",
    ])
  }

  const args = ["blame", "--line-porcelain"]

  if (lines) {
    args.push(`-L`, `${lines[0]},${lines[1]}`)
  }

  const ignoreRevsPath = `${ports.root}/.git-blame-ignore-revs`
  if (ports.fs.exists(ignoreRevsPath)) {
    args.push("--ignore-revs-file", ".git-blame-ignore-revs")
  }

  args.push("--", file)

  const result = ports.git.run(args)
  if (!result.success) {
    throw new ControlError(
      "blame_failed",
      `git blame failed: ${result.stderr.trim()}`,
      [
        "Check that the file is tracked by git",
        lines ? `Line range ${lines[0]}:${lines[1]} may be out of bounds` : "",
      ].filter(Boolean),
    )
  }

  const entries = parsePorcelain(result.stdout)
  const ranges = groupRanges(entries)

  return { what: "blame", file, ranges }
}
