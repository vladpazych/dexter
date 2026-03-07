/**
 * Domain types — command parameters, results, and shared contracts.
 */

export type CommitParams = {
  message: string
  files: string[]
}

export type CommitResult = {
  hash: string
  message: string
  files: string[]
}

export type QualityCheck = {
  name: string
  status: "pass" | "fail"
  output: string
}

export type QualityResult = {
  passed: boolean
  checks: QualityCheck[]
}

export type SetupResult = {
  settingsPath: string
  binPath: string
}

// --- eval ---

export type EvalParams = { code: string; timeout?: number }
export type EvalResult = { ok: boolean; stdout: string; stderr: string }

// --- transcripts ---

export type TranscriptsParams = { skill?: string; minutes?: number }

export type TranscriptEntry = {
  path: string
  agentId: string
  sessionId: string
  skill: string
  timestamp: string
  size: number
}

export type TranscriptsResult = {
  projectSlug: string
  entries: TranscriptEntry[]
}

// --- packages ---

export type Package = {
  name: string
  shortName: string
  dir: string
  relDir: string
  scripts: Record<string, string>
}

// --- blame / pickaxe / bisect ---

export type BlameRange = {
  commit: string
  author: string
  date: string
  message: string
  startLine: number
  endLine: number
  content: string[]
}

export type PickaxeMatch = {
  hash: string
  author: string
  date: string
  message: string
  diff: string
}

export type BisectMatch = {
  hash: string
  author: string
  date: string
  message: string
  diff: string
}

export type GitResult =
  | { what: "blame"; file: string; ranges: BlameRange[] }
  | { what: "pickaxe"; pattern: string; matches: PickaxeMatch[] }
  | { what: "bisect"; match: BisectMatch }

// --- rules / diff / commits / lint / typecheck / test ---

export type RulesScope = { path: string; cascade: string[] }
export type DiffScope = { path: string; status: string; diff: string }
export type CommitsScope = { path: string; log: string[] }

export type CheckError = { line: number; summary: string }
export type CheckData = { errorCount: number; errors: CheckError[]; raw: string }

export type QueryResult =
  | { what: "rules"; scopes: string[]; data: RulesScope[] }
  | { what: "diff"; scopes: string[]; data: DiffScope[] }
  | { what: "commits"; scopes: string[]; data: CommitsScope[]; recent: string[] }
  | { what: "lint"; scopes: string[]; data: CheckData }
  | { what: "typecheck"; scopes: string[]; data: CheckData }
  | { what: "test"; scopes: string[]; data: CheckData }
