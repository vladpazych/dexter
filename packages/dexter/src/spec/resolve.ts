import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

import { z } from "zod"

import type { RepoPorts } from "../meta/ports.ts"

export const specQuerySchema = z.object({
  name: z.string().min(1),
  include: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  exclude: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
  from: z.enum(["target", "target-dir"]).optional(),
  walk: z.enum(["here", "up", "down"]),
  includeAnchor: z.boolean().optional(),
  maxDepth: z.number().int().min(0).optional(),
  stopAt: z.string().min(1).optional(),
  pick: z.enum(["all", "first"]).optional(),
  order: z.enum(["nearest-first", "nearest-last", "path"]).optional(),
})

export type SpecQuery = z.infer<typeof specQuerySchema>

export type SpecMatch = {
  query: string
  path: string
  relPath: string
  relation: "self" | "ancestor" | "descendant"
  distance: number
  anchorDir: string
}

export type ResolvedSpecFiles = {
  target: string
  relTarget: string
  matches: Record<string, SpecMatch[]>
}

type NormalizedSpecQuery = Omit<SpecQuery, "include" | "exclude" | "from" | "includeAnchor" | "pick" | "order"> & {
  include: string[]
  exclude: string[]
  from: "target" | "target-dir"
  includeAnchor: boolean
  pick: "all" | "first"
  order: "nearest-first" | "nearest-last" | "path"
}

type Candidate = {
  path: string
  candidatePath: string
  relation: "self" | "ancestor" | "descendant"
  distance: number
}

export function resolveSpecFiles(
  ports: RepoPorts,
  target: string,
  queries: readonly SpecQuery[],
): ResolvedSpecFiles {
  const normalizedTarget = normalizePath(ports.root, target)
  const normalizedQueries = normalizeQueries(queries)
  const matches = Object.fromEntries(normalizedQueries.map((query) => [query.name, collectMatches(ports, normalizedTarget, query)]))

  return {
    target: normalizedTarget,
    relTarget: toRelPath(ports.root, normalizedTarget),
    matches,
  }
}

function normalizeQueries(queries: readonly SpecQuery[]): NormalizedSpecQuery[] {
  const names = new Set<string>()

  return queries.map((query) => {
    const parsed = specQuerySchema.parse(query)
    if (names.has(parsed.name)) {
      throw new Error(`Duplicate spec query name: ${parsed.name}`)
    }

    names.add(parsed.name)

    return {
      ...parsed,
      include: asArray(parsed.include),
      exclude: asArray(parsed.exclude),
      from: parsed.from ?? "target-dir",
      includeAnchor: parsed.includeAnchor ?? true,
      pick: parsed.pick ?? "all",
      order: parsed.order ?? defaultOrder(parsed.walk),
    }
  })
}

function collectMatches(ports: RepoPorts, target: string, query: NormalizedSpecQuery): SpecMatch[] {
  const anchor = resolveAnchor(ports, target, query)
  const candidates = collectCandidates(ports, target, anchor, query)
  const filtered = candidates.filter((candidate) => matchesQuery(ports, query, candidate.candidatePath))
  const ordered = sortCandidates(filtered, query.order)
  const selected = query.pick === "first" ? ordered.slice(0, 1) : ordered

  return selected.map((candidate) => ({
    query: query.name,
    path: candidate.path,
    relPath: toRelPath(ports.root, candidate.path),
    relation: candidate.relation,
    distance: candidate.distance,
    anchorDir: anchor.anchorDir,
  }))
}

function resolveAnchor(
  ports: RepoPorts,
  target: string,
  query: NormalizedSpecQuery,
): { anchorDir: string; targetIsDirectory: boolean } {
  const targetIsDirectory = isDirectory(ports, target)
  if (query.from === "target" && targetIsDirectory) {
    return { anchorDir: target, targetIsDirectory }
  }

  return {
    anchorDir: targetIsDirectory ? target : dirname(target),
    targetIsDirectory,
  }
}

function collectCandidates(
  ports: RepoPorts,
  target: string,
  anchor: { anchorDir: string; targetIsDirectory: boolean },
  query: NormalizedSpecQuery,
): Candidate[] {
  switch (query.walk) {
    case "here":
      return collectHereCandidates(ports, target, anchor, query)
    case "up":
      return collectUpCandidates(ports, target, anchor, query)
    case "down":
      return collectDownCandidates(ports, target, anchor, query)
  }
}

function collectHereCandidates(
  ports: RepoPorts,
  target: string,
  anchor: { anchorDir: string; targetIsDirectory: boolean },
  query: NormalizedSpecQuery,
): Candidate[] {
  if (query.from === "target" && !anchor.targetIsDirectory) {
    return query.includeAnchor
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

  if (!query.includeAnchor) {
    return []
  }

  return listDirectFiles(ports, anchor.anchorDir).map((file) => ({
    path: join(anchor.anchorDir, file),
    candidatePath: file,
    relation: "self" as const,
    distance: 0,
  }))
}

function collectUpCandidates(
  ports: RepoPorts,
  target: string,
  anchor: { anchorDir: string; targetIsDirectory: boolean },
  query: NormalizedSpecQuery,
): Candidate[] {
  const stopAt = normalizeStopAt(ports.root, query.stopAt)
  const visited: Candidate[] = []
  const startDir = anchor.anchorDir
  let current = startDir
  let distance = 0
  let includeCurrent = query.includeAnchor

  if (query.from === "target" && !anchor.targetIsDirectory && query.includeAnchor) {
    const targetName = basename(target)
    if (matchesQuery(ports, query, targetName)) {
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
      for (const file of listDirectFiles(ports, current)) {
        visited.push({
          path: join(current, file),
          candidatePath: file,
          relation,
          distance,
        })
      }
    }

    if (current === stopAt || current === ports.root) {
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
  ports: RepoPorts,
  target: string,
  anchor: { anchorDir: string; targetIsDirectory: boolean },
  query: NormalizedSpecQuery,
): Candidate[] {
  if (query.from === "target" && !anchor.targetIsDirectory) {
    return query.includeAnchor
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

  const maxDepth = query.maxDepth
  return walkTree(ports, anchor.anchorDir, anchor.anchorDir, maxDepth).filter((candidate) => {
    if (candidate.distance === 0 && !query.includeAnchor) {
      return false
    }

    return true
  })
}

function walkTree(ports: RepoPorts, root: string, current: string, maxDepth: number | undefined): Candidate[] {
  const matches: Candidate[] = []
  const entries = readDirSafe(ports, current)

  for (const entry of entries) {
    const absolute = join(current, entry.name)
    if (entry.isDirectory) {
      const distance = pathDistance(root, absolute)
      if (maxDepth === undefined || distance <= maxDepth) {
        matches.push(...walkTree(ports, root, absolute, maxDepth))
      }
      continue
    }

    matches.push({
      path: absolute,
      candidatePath: toPosixRelative(root, absolute),
      relation: pathDistance(root, absolute) === 0 ? "self" : "descendant",
      distance: pathDistance(root, absolute),
    })
  }

  return matches
}

function matchesQuery(ports: RepoPorts, query: NormalizedSpecQuery, candidatePath: string): boolean {
  const included = query.include.some((pattern) => ports.glob.match(pattern, [candidatePath]).length > 0)
  if (!included) {
    return false
  }

  return !query.exclude.some((pattern) => ports.glob.match(pattern, [candidatePath]).length > 0)
}

function sortCandidates(candidates: Candidate[], order: NormalizedSpecQuery["order"]): Candidate[] {
  return [...candidates].sort((left, right) => {
    switch (order) {
      case "nearest-first":
        return left.distance - right.distance || left.path.localeCompare(right.path)
      case "nearest-last":
        return right.distance - left.distance || left.path.localeCompare(right.path)
      case "path":
        return left.path.localeCompare(right.path)
    }
  })
}

function listDirectFiles(ports: RepoPorts, dir: string): string[] {
  return readDirSafe(ports, dir)
    .filter((entry) => !entry.isDirectory)
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
}

function readDirSafe(ports: RepoPorts, dir: string): Array<{ name: string; isDirectory: boolean }> {
  try {
    return ports.fs.readDir(dir)
  } catch {
    return []
  }
}

function isDirectory(ports: RepoPorts, target: string): boolean {
  try {
    ports.fs.readDir(target)
    return true
  } catch {
    return false
  }
}

function normalizeStopAt(root: string, stopAt: string | undefined): string {
  if (stopAt === undefined) {
    return root
  }

  return normalizePath(root, stopAt)
}

function normalizePath(root: string, target: string): string {
  return isAbsolute(target) ? resolve(target) : resolve(root, target)
}

function asArray(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return []
  }

  return typeof value === "string" ? [value] : value
}

function defaultOrder(walk: SpecQuery["walk"]): NormalizedSpecQuery["order"] {
  return walk === "up" ? "nearest-first" : "path"
}

function pathDistance(root: string, target: string): number {
  const rel = relative(root, target)
  if (rel.length === 0) {
    return 0
  }

  const dir = dirname(rel)
  if (dir === ".") {
    return 0
  }

  return dir.split(sep).length
}

function toRelPath(root: string, target: string): string {
  const rel = relative(root, target)
  return rel.length === 0 ? "." : rel
}

function toPosixRelative(root: string, target: string): string {
  return toRelPath(root, target).split(sep).join("/")
}

function basename(path: string): string {
  const parts = path.split(sep)
  return parts[parts.length - 1] ?? path
}
