import { readdirSync, statSync } from "node:fs"
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path"

import { minimatch } from "minimatch"

type FileWalk = "here" | "up" | "down"
type FileBase = "path" | "dir"
type FilePick = "all" | "first"
type FileOrder = "nearest-first" | "nearest-last" | "path"

export type FileQuery = {
  from: string
  include: string | string[]
  exclude?: string | string[]
  walk: FileWalk
  base?: FileBase
  includeBase?: boolean
  maxDepth?: number
  stopAt?: string
  pick?: FilePick
  order?: FileOrder
}

export type FileMatch = {
  path: string
  relPath: string
  relation: "self" | "ancestor" | "descendant"
  distance: number
  baseDir: string
}

type FileContext = {
  root: string
}

type NormalizedFileQuery = Omit<
  FileQuery,
  "include" | "exclude" | "base" | "pick" | "order"
> & {
  include: string[]
  exclude: string[]
  base: FileBase
  includeBase: boolean
  pick: FilePick
  order: FileOrder
}

type Candidate = {
  path: string
  candidatePath: string
  relation: "self" | "ancestor" | "descendant"
  distance: number
}

type BaseInfo = {
  baseDir: string
  fromIsDirectory: boolean
}

export function collectFiles(
  query: FileQuery,
  context: Partial<FileContext> = {},
): FileMatch[] {
  const root = context.root ?? process.cwd()
  const normalizedQuery = normalizeQuery(query)
  const target = normalizePath(root, normalizedQuery.from)
  const base = resolveBase(target, normalizedQuery)
  const candidates = collectCandidates(root, target, base, normalizedQuery)
  const filtered = candidates.filter((candidate) =>
    matchesQuery(normalizedQuery, candidate.candidatePath),
  )
  const ordered = sortCandidates(filtered, normalizedQuery.order)
  const selected =
    normalizedQuery.pick === "first" ? ordered.slice(0, 1) : ordered

  return selected.map((candidate) => ({
    path: candidate.path,
    relPath: toRelPath(root, candidate.path),
    relation: candidate.relation,
    distance: candidate.distance,
    baseDir: base.baseDir,
  }))
}

export function findFile(
  query: FileQuery,
  context: Partial<FileContext> = {},
): FileMatch | undefined {
  return collectFiles(
    {
      ...query,
      pick: "first",
    },
    context,
  )[0]
}

function normalizeQuery(query: FileQuery): NormalizedFileQuery {
  assertValidQuery(query)

  return {
    ...query,
    include: asArray(query.include),
    exclude: asArray(query.exclude),
    base: query.base ?? "dir",
    includeBase: query.includeBase ?? true,
    pick: query.pick ?? "all",
    order: query.order ?? defaultOrder(query.walk),
  }
}

function resolveBase(target: string, query: NormalizedFileQuery): BaseInfo {
  const fromIsDirectory = isDirectory(target)
  if (query.base === "path" && fromIsDirectory) {
    return {
      baseDir: target,
      fromIsDirectory,
    }
  }

  return {
    baseDir: fromIsDirectory ? target : dirname(target),
    fromIsDirectory,
  }
}

function collectCandidates(
  root: string,
  target: string,
  base: BaseInfo,
  query: NormalizedFileQuery,
): Candidate[] {
  switch (query.walk) {
    case "here":
      return collectHereCandidates(target, base, query)
    case "up":
      return collectUpCandidates(root, target, base, query)
    case "down":
      return collectDownCandidates(target, base, query)
  }
}

function collectHereCandidates(
  target: string,
  base: BaseInfo,
  query: NormalizedFileQuery,
): Candidate[] {
  if (query.base === "path" && !base.fromIsDirectory) {
    return query.includeBase
      ? [
          {
            path: target,
            candidatePath: basename(target),
            relation: "self",
            distance: 0,
          },
        ]
      : []
  }

  if (!query.includeBase) {
    return []
  }

  return listDirectFiles(base.baseDir).map((file) => ({
    path: join(base.baseDir, file),
    candidatePath: file,
    relation: "self" as const,
    distance: 0,
  }))
}

function collectUpCandidates(
  root: string,
  target: string,
  base: BaseInfo,
  query: NormalizedFileQuery,
): Candidate[] {
  const stopAt = normalizeStopAt(root, query.stopAt)
  const visited: Candidate[] = []
  let current = base.baseDir
  let distance = 0
  let includeCurrent = query.includeBase

  if (query.base === "path" && !base.fromIsDirectory && query.includeBase) {
    const targetName = basename(target)
    if (matchesQuery(query, targetName)) {
      visited.push({
        path: target,
        candidatePath: targetName,
        relation: "self",
        distance: 0,
      })
    }
  }

  while (true) {
    if (includeCurrent) {
      const relation = distance === 0 ? "self" : "ancestor"
      for (const file of listDirectFiles(current)) {
        visited.push({
          path: join(current, file),
          candidatePath: file,
          relation,
          distance,
        })
      }
    }

    if (current === stopAt || current === root) {
      break
    }

    const parent = dirname(current)
    if (parent === current) {
      break
    }

    current = parent
    includeCurrent = true
    distance += 1
  }

  return visited
}

function collectDownCandidates(
  target: string,
  base: BaseInfo,
  query: NormalizedFileQuery,
): Candidate[] {
  if (query.base === "path" && !base.fromIsDirectory) {
    return query.includeBase
      ? [
          {
            path: target,
            candidatePath: basename(target),
            relation: "self",
            distance: 0,
          },
        ]
      : []
  }

  const candidates = walkTree(base.baseDir, base.baseDir, query.maxDepth)
  return query.includeBase
    ? candidates
    : candidates.filter(
        (candidate) =>
          !(candidate.distance === 0 && candidate.relation === "self"),
      )
}

function walkTree(
  root: string,
  current: string,
  maxDepth: number | undefined,
): Candidate[] {
  const entries = readDirSafe(current)
  const candidates: Candidate[] = []

  for (const entry of entries) {
    const absolute = join(current, entry.name)
    const relFromRoot = relative(root, absolute)
    const distance =
      relFromRoot.length === 0 ? 0 : relFromRoot.split(sep).length

    if (entry.isDirectory) {
      if (maxDepth === undefined || distance <= maxDepth) {
        candidates.push(...walkTree(root, absolute, maxDepth))
      }
      continue
    }

    candidates.push({
      path: absolute,
      candidatePath:
        relFromRoot === "" ? entry.name : relFromRoot.split(sep).join("/"),
      relation: distance === 1 ? "self" : "descendant",
      distance: Math.max(distance - 1, 0),
    })
  }

  return candidates
}

function matchesQuery(
  query: NormalizedFileQuery,
  candidatePath: string,
): boolean {
  const included = query.include.some((pattern) =>
    minimatch(candidatePath, pattern, { dot: true }),
  )
  if (!included) {
    return false
  }

  return !query.exclude.some((pattern) =>
    minimatch(candidatePath, pattern, { dot: true }),
  )
}

function listDirectFiles(dir: string): string[] {
  return readDirSafe(dir)
    .filter((entry) => !entry.isDirectory)
    .map((entry) => entry.name)
}

function readDirSafe(
  dir: string,
): Array<{ name: string; isDirectory: boolean }> {
  try {
    return readdirSync(dir, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }))
  } catch {
    return []
  }
}

function isDirectory(target: string): boolean {
  try {
    return statSync(target).isDirectory()
  } catch {
    return false
  }
}

function normalizeStopAt(
  root: string,
  stopAt: string | undefined,
): string | undefined {
  if (stopAt === undefined) {
    return undefined
  }

  return normalizePath(root, stopAt)
}

function normalizePath(root: string, path: string): string {
  return isAbsolute(path) ? resolve(path) : resolve(root, path)
}

function toRelPath(root: string, path: string): string {
  const rel = relative(root, path)
  return rel.length === 0 ? "." : rel.split(sep).join("/")
}

function asArray(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

function defaultOrder(walk: FileWalk): FileOrder {
  switch (walk) {
    case "up":
      return "nearest-first"
    case "down":
      return "path"
    case "here":
      return "path"
  }
}

function sortCandidates(
  candidates: Candidate[],
  order: FileOrder,
): Candidate[] {
  return [...candidates].sort((left, right) => {
    switch (order) {
      case "nearest-first":
        return (
          left.distance - right.distance || left.path.localeCompare(right.path)
        )
      case "nearest-last":
        return (
          right.distance - left.distance || left.path.localeCompare(right.path)
        )
      case "path":
        return left.path.localeCompare(right.path)
    }
  })
}

function assertValidQuery(query: FileQuery): void {
  if (query.from.trim().length === 0) {
    throw new Error("files query 'from' must be a non-empty string")
  }

  assertStringOrStringArray(query.include, "include", { allowEmpty: false })
  assertStringOrStringArray(query.exclude, "exclude", {
    allowEmpty: false,
    optional: true,
  })
  assertEnum(query.walk, ["here", "up", "down"], "walk")
  assertEnum(query.base, ["path", "dir"], "base", true)
  assertBoolean(query.includeBase, "includeBase", true)
  assertNonNegativeInteger(query.maxDepth, "maxDepth", true)
  assertNonEmptyString(query.stopAt, "stopAt", true)
  assertEnum(query.pick, ["all", "first"], "pick", true)
  assertEnum(
    query.order,
    ["nearest-first", "nearest-last", "path"],
    "order",
    true,
  )
}

function assertStringOrStringArray(
  value: string | string[] | undefined,
  field: string,
  options: { allowEmpty: boolean; optional?: boolean },
): void {
  if (value === undefined) {
    if (options.optional === true) {
      return
    }

    throw new Error(`files query '${field}' is required`)
  }

  if (typeof value === "string") {
    if (!options.allowEmpty && value.trim().length === 0) {
      throw new Error(`files query '${field}' must not be empty`)
    }
    return
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `files query '${field}' must be a string or non-empty array of strings`,
    )
  }

  for (const item of value) {
    if (
      typeof item !== "string" ||
      (!options.allowEmpty && item.trim().length === 0)
    ) {
      throw new Error(
        `files query '${field}' must contain only non-empty strings`,
      )
    }
  }
}

function assertEnum<T extends string>(
  value: T | undefined,
  allowed: readonly T[],
  field: string,
  optional = false,
): void {
  if (value === undefined) {
    if (optional) {
      return
    }

    throw new Error(`files query '${field}' is required`)
  }

  if (!allowed.includes(value)) {
    throw new Error(
      `files query '${field}' must be one of: ${allowed.join(", ")}`,
    )
  }
}

function assertBoolean(
  value: boolean | undefined,
  field: string,
  optional = false,
): void {
  if (value === undefined) {
    if (optional) {
      return
    }

    throw new Error(`files query '${field}' is required`)
  }

  if (typeof value !== "boolean") {
    throw new Error(`files query '${field}' must be a boolean`)
  }
}

function assertNonNegativeInteger(
  value: number | undefined,
  field: string,
  optional = false,
): void {
  if (value === undefined) {
    if (optional) {
      return
    }

    throw new Error(`files query '${field}' is required`)
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`files query '${field}' must be a non-negative integer`)
  }
}

function assertNonEmptyString(
  value: string | undefined,
  field: string,
  optional = false,
): void {
  if (value === undefined) {
    if (optional) {
      return
    }

    throw new Error(`files query '${field}' is required`)
  }

  if (value.trim().length === 0) {
    throw new Error(`files query '${field}' must not be empty`)
  }
}
