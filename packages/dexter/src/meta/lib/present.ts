/**
 * Presenter layer — domain results → Node trees.
 *
 * Pure functions. Each converts a typed domain result into a document tree
 * that renders polymorphically via dexter's output module.
 */

import { block, field, heading, list, text } from "../../output/index.ts"
import type { Node } from "../../output/index.ts"

import type {
  CommitResult,
  EvalResult,
  GitResult,
  Package,
  QueryResult,
  SetupResult,
  TranscriptsResult,
} from "../types.ts"
import type { ControlError } from "../errors.ts"

// --- Query ---

function presentRules(result: Extract<QueryResult, { what: "rules" }>): Node {
  return block(
    "rules",
    ...result.data.map((scope) =>
      block(
        "scope",
        { path: scope.path },
        heading(scope.path),
        field("cascade", list("ref", ...scope.cascade.map((c) => text(c)))),
      ),
    ),
  )
}

function presentDiff(result: Extract<QueryResult, { what: "diff" }>): Node {
  return block(
    "diff",
    ...result.data.map((scope) => {
      const parts: Node[] = [heading(scope.path)]
      if (scope.status) parts.push(field("status", scope.status))
      if (scope.diff) parts.push(field("diff", scope.diff))
      return block("scope", { path: scope.path }, ...parts)
    }),
  )
}

function presentCommits(result: Extract<QueryResult, { what: "commits" }>): Node {
  const children: Node[] = result.data.map((scope) =>
    block(
      "scope",
      { path: scope.path },
      heading(scope.path),
      field("log", list("entry", ...scope.log.map((l) => text(l)))),
    ),
  )
  if (result.recent.length > 0) {
    children.push(
      block(
        "recent-commits",
        heading("Recent Commits"),
        field("entries", list("entry", ...result.recent.map((l) => text(l)))),
      ),
    )
  }
  return block("commits", ...children)
}

function presentCheck(result: Extract<QueryResult, { what: "lint" | "typecheck" | "test" }>): Node {
  const { what, data } = result
  const children: Node[] = [field("errorCount", data.errorCount)]
  if (data.errors.length > 0) {
    children.push(field("errors", list("error", ...data.errors.map((e) => text(e.summary)))))
  }
  if (data.raw) {
    children.push(field("raw", data.raw))
  }
  return block(what, ...children)
}

export function presentQuery(result: QueryResult): Node {
  switch (result.what) {
    case "rules":
      return presentRules(result)
    case "diff":
      return presentDiff(result)
    case "commits":
      return presentCommits(result)
    case "lint":
    case "typecheck":
    case "test":
      return presentCheck(result)
  }
}

// --- Git ---

function presentBlame(result: Extract<GitResult, { what: "blame" }>): Node {
  return block(
    "blame",
    { file: result.file },
    heading(result.file),
    ...result.ranges.map((r) =>
      block(
        "range",
        { commit: r.commit, lines: `${r.startLine}-${r.endLine}` },
        field("commit", r.commit),
        field("author", r.author),
        field("date", r.date),
        field("message", r.message),
        field("lines", `${r.startLine}-${r.endLine}`),
        field("content", r.content.join("\n")),
      ),
    ),
  )
}

function presentPickaxe(result: Extract<GitResult, { what: "pickaxe" }>): Node {
  if (result.matches.length === 0) {
    return block("pickaxe", { pattern: result.pattern }, field("matches", "none"))
  }
  return block(
    "pickaxe",
    { pattern: result.pattern },
    ...result.matches.map((m) =>
      block(
        "match",
        { hash: m.hash },
        field("hash", m.hash),
        field("author", m.author),
        field("date", m.date),
        field("message", m.message),
        field("diff", m.diff),
      ),
    ),
  )
}

function presentBisect(result: Extract<GitResult, { what: "bisect" }>): Node {
  const m = result.match
  return block(
    "bisect",
    { hash: m.hash },
    field("hash", m.hash),
    field("author", m.author),
    field("date", m.date),
    field("message", m.message),
    field("diff", m.diff),
  )
}

export function presentGit(result: GitResult): Node {
  switch (result.what) {
    case "blame":
      return presentBlame(result)
    case "pickaxe":
      return presentPickaxe(result)
    case "bisect":
      return presentBisect(result)
  }
}

// --- Commit ---

export function presentCommit(result: CommitResult): Node {
  return block(
    "commit",
    field("hash", result.hash),
    field("message", result.message),
    field("files", list("file", ...result.files.map((f) => text(f)))),
  )
}

// --- Eval ---

export function presentEval(result: EvalResult): Node {
  const children: Node[] = []
  if (result.stdout) children.push(field("stdout", result.stdout))
  if (result.stderr) children.push(field("stderr", result.stderr))
  return block("eval", { ok: String(result.ok) }, ...children)
}

// --- Packages ---

export function presentPackages(packages: Package[]): Node {
  return list(
    "package",
    ...packages.map((pkg) => block("package", field("name", pkg.shortName), field("dir", pkg.relDir))),
  )
}

// --- Setup ---

export function presentSetup(result: SetupResult): Node {
  return block("setup", field("settings", result.settingsPath), field("bin", result.binPath))
}

// --- Transcripts ---

export function presentTranscripts(result: TranscriptsResult): Node {
  if (result.entries.length === 0) {
    return block("transcripts", { project: result.projectSlug }, field("entries", "none"))
  }
  return block(
    "transcripts",
    { project: result.projectSlug },
    ...result.entries.map((entry) =>
      block(
        "transcript",
        { agentId: entry.agentId },
        field("path", entry.path),
        field("skill", entry.skill),
        field("session", entry.sessionId),
        field("timestamp", entry.timestamp),
        field("size", entry.size),
      ),
    ),
  )
}

// --- Error ---

export function presentError(err: ControlError): Node {
  const children: Node[] = [field("code", err.code), field("message", text(err.message, "red"))]
  if (err.hints.length > 0) {
    children.push(field("hints", list("hint", ...err.hints.map((h) => text(h)))))
  }
  return block("error", ...children)
}
