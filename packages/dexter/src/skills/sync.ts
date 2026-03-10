import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

import { z } from "zod"

import { createRepoPorts } from "../meta/adapters/index.ts"
import { findRepoRoot } from "../meta/lib/paths.ts"
import type { RepoPorts } from "../meta/ports.ts"

export const githubSkillSourceSchema = z.object({
  kind: z.literal("github"),
  url: z.url(),
})

export type GitHubSkillSource = z.infer<typeof githubSkillSourceSchema>

export const skillSyncOptionsSchema = z.object({
  source: githubSkillSourceSchema,
  targetDir: z.string().min(1),
  mode: z.enum(["plan", "apply"]).optional(),
  trashDir: z.string().min(1).optional(),
  deleteMissing: z.boolean().optional(),
  conflictPolicy: z.enum(["replace", "skip"]).optional(),
})

export type SkillSyncOptions = z.infer<typeof skillSyncOptionsSchema>

export type ResolvedGitHubSkillSource = {
  kind: "github"
  repo: string
  ref: string
  subpath: string
  url: string
}

export type SkillSyncChange =
  | { kind: "create"; path: string; entry: "file" }
  | { kind: "update"; path: string; entry: "file" }
  | { kind: "delete"; path: string; entry: "file" | "directory" }
  | { kind: "skip"; path: string; entry: "file" | "directory"; reason: string }
  | { kind: "backup"; path: string; entry: "file" | "directory"; backupPath: string }

export type SkillSyncResult = {
  source: ResolvedGitHubSkillSource
  targetDir: string
  applied: boolean
  changed: boolean
  changes: SkillSyncChange[]
  warnings: string[]
}

type RemoteSkillFile = {
  path: string
  bytes: Uint8Array
}

type PlannedOperation =
  | { kind: "create"; path: string; entry: "file"; absolutePath: string; bytes: Uint8Array }
  | { kind: "update"; path: string; entry: "file"; absolutePath: string; bytes: Uint8Array }
  | { kind: "delete"; path: string; entry: "file" | "directory"; absolutePath: string }
  | { kind: "skip"; path: string; entry: "file" | "directory"; reason: string }
  | {
      kind: "backup"
      path: string
      entry: "file" | "directory"
      absolutePath: string
      backupAbsolutePath: string
      backupPath: string
    }

type LocalSnapshot = {
  files: Map<string, Uint8Array>
  dirs: Set<string>
}

type GitHubDirEntry = {
  type?: string
  name?: string
  path?: string
  download_url?: string | null
}

type GitHubRepo = {
  default_branch?: string
}

export async function syncSkill(options: SkillSyncOptions): Promise<SkillSyncResult> {
  const parsed = skillSyncOptionsSchema.parse(options)
  const root = findRepoRoot()
  const ports = createRepoPorts(root)
  const targetDir = normalizePath(root, parsed.targetDir)
  const trashDir = parsed.trashDir === undefined ? undefined : normalizePath(root, parsed.trashDir)
  const mode = parsed.mode ?? "plan"
  const deleteMissing = parsed.deleteMissing ?? false
  const conflictPolicy = parsed.conflictPolicy ?? "replace"

  if (trashDir !== undefined && isNestedPath(targetDir, trashDir)) {
    throw new Error("trashDir must be outside the managed targetDir")
  }

  const source = await resolveGitHubSource(parsed.source)
  const remoteFiles = await fetchRemoteSkillFiles(source)
  const operations = planSkillSync({
    ports,
    root,
    targetDir,
    trashDir,
    deleteMissing,
    conflictPolicy,
    remoteFiles,
  })

  if (mode === "apply") {
    await applyOperations(ports, operations)
  }

  const changes = operations.map(toChange)

  return {
    source,
    targetDir,
    applied: mode === "apply",
    changed: changes.some((change) => change.kind !== "skip" && change.kind !== "backup"),
    changes,
    warnings: [],
  }
}

async function resolveGitHubSource(source: GitHubSkillSource): Promise<ResolvedGitHubSkillSource> {
  const url = new URL(source.url)
  if (url.hostname !== "github.com") {
    throw new Error(`Unsupported skill source host: ${url.hostname}`)
  }

  const parts = url.pathname.split("/").filter((part) => part.length > 0)
  const owner = parts[0]
  const repo = parts[1]
  if (owner === undefined || repo === undefined) {
    throw new Error(`Invalid GitHub skill URL: ${source.url}`)
  }

  if (parts.length === 2) {
    const repoMeta = await fetchJson<GitHubRepo>(`https://api.github.com/repos/${owner}/${repo}`)
    const ref = repoMeta.default_branch
    if (typeof ref !== "string" || ref.length === 0) {
      throw new Error(`Unable to resolve default branch for ${owner}/${repo}`)
    }

    return {
      kind: "github",
      repo: `${owner}/${repo}`,
      ref,
      subpath: "",
      url: source.url,
    }
  }

  if (parts[2] !== "tree") {
    throw new Error(`Unsupported GitHub skill URL: ${source.url}`)
  }

  const ref = parts[3]
  if (ref === undefined || ref.length === 0) {
    throw new Error(`GitHub tree URL is missing a ref: ${source.url}`)
  }

  return {
    kind: "github",
    repo: `${owner}/${repo}`,
    ref,
    subpath: parts.slice(4).join("/"),
    url: source.url,
  }
}

async function fetchRemoteSkillFiles(source: ResolvedGitHubSkillSource): Promise<RemoteSkillFile[]> {
  const [owner, repo] = source.repo.split("/")
  if (owner === undefined || repo === undefined) {
    throw new Error(`Invalid GitHub repo identifier: ${source.repo}`)
  }

  const basePath = source.subpath
  const entries = await fetchDirectory(owner, repo, source.ref, basePath, basePath)

  return entries.sort((left, right) => left.path.localeCompare(right.path))
}

async function fetchDirectory(
  owner: string,
  repo: string,
  ref: string,
  subpath: string,
  rootSubpath: string,
): Promise<RemoteSkillFile[]> {
  const apiPath = subpath
  const endpoint = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${apiPath}`)
  endpoint.searchParams.set("ref", ref)

  const payload = await fetchJson<unknown>(endpoint.toString())
  if (!Array.isArray(payload)) {
    throw new Error(`GitHub skill path is not a directory: ${owner}/${repo}${subpath}`)
  }

  const files: RemoteSkillFile[] = []
  for (const rawEntry of payload) {
    const entry = parseGitHubDirEntry(rawEntry)
    switch (entry.type) {
      case "dir":
        files.push(...(await fetchDirectory(owner, repo, ref, entry.path, rootSubpath)))
        break
      case "file": {
        const remotePath =
          rootSubpath.length === 0 ? entry.path : entry.path.slice(rootSubpath.length).replace(/^\/+/, "")
        const downloadUrl =
          entry.download_url ??
          `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${entry.path}`
        files.push({
          path: remotePath,
          bytes: await fetchBytes(downloadUrl),
        })
        break
      }
      default:
        throw new Error(`Unsupported GitHub directory entry type: ${entry.type ?? "unknown"}`)
    }
  }

  return files
}

function parseGitHubDirEntry(value: unknown): Required<Pick<GitHubDirEntry, "path" | "type">> & GitHubDirEntry {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid GitHub contents response")
  }

  const entry = value as GitHubDirEntry
  if (typeof entry.path !== "string" || typeof entry.type !== "string") {
    throw new Error("Invalid GitHub directory entry")
  }

  return {
    path: entry.path,
    type: entry.type,
    name: entry.name,
    download_url: entry.download_url,
  }
}

function planSkillSync(input: {
  ports: RepoPorts
  root: string
  targetDir: string
  trashDir: string | undefined
  deleteMissing: boolean
  conflictPolicy: "replace" | "skip"
  remoteFiles: RemoteSkillFile[]
}): PlannedOperation[] {
  const snapshot = snapshotLocal(input.ports, input.targetDir)
  const operations: PlannedOperation[] = []
  const remotePaths = new Set(input.remoteFiles.map((file) => file.path))
  const plannedClears = new Set<string>()

  for (const remoteFile of input.remoteFiles) {
    const blockers = findBlockingPaths(snapshot, remoteFile.path)
    for (const blocker of blockers) {
      if (plannedClears.has(blocker.path)) {
        continue
      }

      plannedClears.add(blocker.path)
      operations.push(...planClearPath(input, snapshot, blocker.path, blocker.entry))
    }

    const absolutePath = join(input.targetDir, remoteFile.path)
    const existing = snapshot.files.get(remoteFile.path)

    if (existing === undefined) {
      operations.push({
        kind: "create",
        path: remoteFile.path,
        entry: "file",
        absolutePath,
        bytes: remoteFile.bytes,
      })
      snapshot.files.set(remoteFile.path, remoteFile.bytes)
      rememberParentDirs(snapshot, remoteFile.path)
      continue
    }

    if (bytesEqual(existing, remoteFile.bytes)) {
      continue
    }

    if (input.conflictPolicy === "skip") {
      operations.push({
        kind: "skip",
        path: remoteFile.path,
        entry: "file",
        reason: "local file differs from remote",
      })
      continue
    }

    if (input.trashDir !== undefined) {
      operations.push(planBackup(input.root, input.targetDir, input.trashDir, input.ports, remoteFile.path, "file"))
    }

    operations.push({
      kind: "update",
      path: remoteFile.path,
      entry: "file",
      absolutePath,
      bytes: remoteFile.bytes,
    })
    snapshot.files.set(remoteFile.path, remoteFile.bytes)
  }

  if (input.deleteMissing) {
    const extraFiles = [...snapshot.files.keys()]
      .filter((path) => !remotePaths.has(path))
      .sort((left, right) => left.localeCompare(right))

    for (const filePath of extraFiles) {
      operations.push(...planClearPath(input, snapshot, filePath, "file"))
    }

    const extraDirs = [...snapshot.dirs]
      .filter((dir) => dir.length > 0 && !isRequiredDir(dir, remotePaths))
      .sort((left, right) => right.localeCompare(left))

    for (const dirPath of extraDirs) {
      if (!snapshot.dirs.has(dirPath)) {
        continue
      }

      operations.push(...planClearPath(input, snapshot, dirPath, "directory"))
    }
  }

  return operations
}

function planClearPath(
  input: {
    ports: RepoPorts
    root: string
    targetDir: string
    trashDir: string | undefined
  },
  snapshot: LocalSnapshot,
  relativePath: string,
  entry: "file" | "directory",
): PlannedOperation[] {
  const operations: PlannedOperation[] = []
  const absolutePath = join(input.targetDir, relativePath)

  if (input.trashDir !== undefined) {
    operations.push(planBackup(input.root, input.targetDir, input.trashDir, input.ports, relativePath, entry))
  }

  operations.push({
    kind: "delete",
    path: relativePath,
    entry,
    absolutePath,
  })
  removeSnapshotPath(snapshot, relativePath, entry)
  return operations
}

function planBackup(
  root: string,
  targetDir: string,
  trashDir: string,
  ports: RepoPorts,
  relativePath: string,
  entry: "file" | "directory",
): PlannedOperation {
  const absolutePath = join(targetDir, relativePath)
  const backupAbsolutePath = nextBackupPath(ports, trashDir, relativePath)
  return {
    kind: "backup",
    path: relativePath,
    entry,
    absolutePath,
    backupAbsolutePath,
    backupPath: displayPath(root, backupAbsolutePath),
  }
}

function findBlockingPaths(snapshot: LocalSnapshot, relativePath: string): Array<{ path: string; entry: "file" | "directory" }> {
  const blockers: Array<{ path: string; entry: "file" | "directory" }> = []
  const segments = relativePath.split("/")

  for (let index = 1; index < segments.length; index++) {
    const prefix = segments.slice(0, index).join("/")
    if (snapshot.files.has(prefix)) {
      blockers.push({ path: prefix, entry: "file" })
      break
    }
  }

  if (snapshot.dirs.has(relativePath)) {
    blockers.push({ path: relativePath, entry: "directory" })
  }

  return blockers
}

function snapshotLocal(ports: RepoPorts, targetDir: string): LocalSnapshot {
  const snapshot: LocalSnapshot = {
    files: new Map<string, Uint8Array>(),
    dirs: new Set<string>(),
  }

  if (!ports.fs.exists(targetDir) || !isDirectory(ports, targetDir)) {
    return snapshot
  }

  walkLocalDir(ports, targetDir, "", snapshot)
  return snapshot
}

function walkLocalDir(ports: RepoPorts, absoluteDir: string, relativeDir: string, snapshot: LocalSnapshot): void {
  for (const entry of ports.fs.readDir(absoluteDir)) {
    const absolutePath = join(absoluteDir, entry.name)
    const relativePath = relativeDir.length === 0 ? entry.name : `${relativeDir}/${entry.name}`
    if (entry.isDirectory) {
      snapshot.dirs.add(relativePath)
      walkLocalDir(ports, absolutePath, relativePath, snapshot)
      continue
    }

    snapshot.files.set(relativePath, ports.fs.readBytes(absolutePath))
  }
}

function removeSnapshotPath(snapshot: LocalSnapshot, relativePath: string, entry: "file" | "directory"): void {
  snapshot.files.delete(relativePath)
  if (entry === "directory") {
    snapshot.dirs.delete(relativePath)
    for (const path of [...snapshot.files.keys()]) {
      if (path.startsWith(`${relativePath}/`)) {
        snapshot.files.delete(path)
      }
    }
    for (const dir of [...snapshot.dirs]) {
      if (dir.startsWith(`${relativePath}/`)) {
        snapshot.dirs.delete(dir)
      }
    }
    return
  }

  snapshot.dirs.delete(relativePath)
}

function rememberParentDirs(snapshot: LocalSnapshot, relativePath: string): void {
  const parts = relativePath.split("/")
  for (let index = 1; index < parts.length; index++) {
    snapshot.dirs.add(parts.slice(0, index).join("/"))
  }
}

function isRequiredDir(dir: string, remotePaths: Set<string>): boolean {
  for (const remotePath of remotePaths) {
    if (remotePath === dir || remotePath.startsWith(`${dir}/`)) {
      return true
    }
  }

  return false
}

async function applyOperations(ports: RepoPorts, operations: PlannedOperation[]): Promise<void> {
  for (const operation of operations) {
    switch (operation.kind) {
      case "backup":
        ensureParentDir(ports, operation.backupAbsolutePath)
        ports.fs.rename(operation.absolutePath, operation.backupAbsolutePath)
        break
      case "delete":
        removePath(ports, operation.absolutePath, operation.entry)
        break
      case "create":
      case "update":
        clearBlockingAncestors(ports, operation.absolutePath)
        if (ports.fs.exists(operation.absolutePath) && isDirectory(ports, operation.absolutePath)) {
          removePath(ports, operation.absolutePath, "directory")
        }
        ensureParentDir(ports, operation.absolutePath)
        ports.fs.writeBytes(operation.absolutePath, operation.bytes)
        break
      case "skip":
        break
    }
  }
}

function clearBlockingAncestors(ports: RepoPorts, targetPath: string): void {
  const root = dirname(targetPath)
  let current = root
  const ancestors: string[] = []

  while (true) {
    ancestors.push(current)
    const parent = dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }

  ancestors.reverse()
  for (const ancestor of ancestors) {
    if (!ports.fs.exists(ancestor)) {
      continue
    }
    if (isDirectory(ports, ancestor)) {
      continue
    }

    removePath(ports, ancestor, "file")
    ports.fs.mkdir(ancestor)
  }
}

function removePath(ports: RepoPorts, absolutePath: string, entry: "file" | "directory"): void {
  if (!ports.fs.exists(absolutePath)) {
    return
  }

  if (entry === "file") {
    ports.fs.unlink(absolutePath)
    return
  }

  for (const child of ports.fs.readDir(absolutePath)) {
    removePath(ports, join(absolutePath, child.name), child.isDirectory ? "directory" : "file")
  }
  ports.fs.rmdir(absolutePath)
}

function ensureParentDir(ports: RepoPorts, filePath: string): void {
  ports.fs.mkdir(dirname(filePath))
}

function nextBackupPath(ports: RepoPorts, trashDir: string, relativePath: string): string {
  const safePath = relativePath.split("/").join(sep)
  let candidate = join(trashDir, safePath)
  let index = 1

  while (ports.fs.exists(candidate)) {
    candidate = join(trashDir, `${safePath}.${index}`)
    index += 1
  }

  return candidate
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

function toChange(operation: PlannedOperation): SkillSyncChange {
  switch (operation.kind) {
    case "backup":
      return {
        kind: "backup",
        path: operation.path,
        entry: operation.entry,
        backupPath: operation.backupPath,
      }
    case "create":
      return { kind: "create", path: operation.path, entry: operation.entry }
    case "update":
      return { kind: "update", path: operation.path, entry: operation.entry }
    case "delete":
      return { kind: "delete", path: operation.path, entry: operation.entry }
    case "skip":
      return {
        kind: "skip",
        path: operation.path,
        entry: operation.entry,
        reason: operation.reason,
      }
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "@vladpazych/dexter",
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}): ${url}`)
  }

  return (await response.json()) as T
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "@vladpazych/dexter",
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub download failed (${response.status}): ${url}`)
  }

  return new Uint8Array(await response.arrayBuffer())
}

function normalizePath(root: string, inputPath: string): string {
  return isAbsolute(inputPath) ? resolve(inputPath) : resolve(root, inputPath)
}

function displayPath(root: string, absolutePath: string): string {
  const rel = relative(root, absolutePath)
  return rel.startsWith("..") ? absolutePath : rel
}

function isNestedPath(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel.length > 0 && !rel.startsWith("..") && !isAbsolute(rel)
}

function isDirectory(ports: RepoPorts, targetPath: string): boolean {
  try {
    ports.fs.readDir(targetPath)
    return true
  } catch {
    return false
  }
}
