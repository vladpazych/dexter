/**
 * Commit domain logic — isolated git commit using temporary index.
 */

import { join } from "node:path"

import { ControlError } from "../errors.ts"
import type { ControlPorts } from "../ports.ts"
import type { CommitParams, CommitResult } from "../types.ts"

import { checkQuality } from "./quality.ts"

const MAX_MESSAGE_LENGTH = 72

function fail(code: string, message: string, hints: string[] = []): never {
  throw new ControlError(code, message, hints)
}

export async function commit(ports: ControlPorts, params: CommitParams): Promise<CommitResult> {
  const { message, files } = params

  if (!ports.git.run(["--version"]).success) {
    fail("git_not_found", "git not installed", ["install git to use this command"])
  }
  if (!ports.git.run(["rev-parse", "--is-inside-work-tree"]).success) {
    fail("not_repo", "not a git repository", ["run from within a git repository, or run 'git init' first"])
  }
  if (!ports.git.run(["rev-parse", "HEAD"]).success) {
    fail("no_commits", "repository has no commits", [
      "create an initial commit first: git commit --allow-empty -m 'initial commit'",
    ])
  }

  if (!message) {
    fail("empty_message", "commit message cannot be empty", ["describe why this change exists"])
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    fail("message_too_long", `message exceeds ${MAX_MESSAGE_LENGTH} characters (${message.length})`, [
      "keep the commit message concise — one line explaining why",
    ])
  }

  if (files.length === 0) {
    fail("no_files", "no files to commit", ['bun run meta/index.ts commit "message" file1 file2 ...'])
  }

  const quality = await checkQuality(ports, files)
  if (!quality.passed) {
    const diagnostics = quality.checks.filter((c) => c.status === "fail").map((c) => `${c.name}: ${c.output}`)
    fail("quality_failed", "quality checks failed", diagnostics)
  }

  const tempIndex = join(ports.tmpdir(), `git-index.${process.pid}.${Date.now()}`)
  const indexEnv = { GIT_INDEX_FILE: tempIndex }

  try {
    const readTreeResult = ports.git.run(["read-tree", "HEAD"], indexEnv)
    if (!readTreeResult.success) {
      fail("read_tree_failed", "failed to read git tree", [readTreeResult.stderr])
    }

    const headTree = ports.git.run(["ls-tree", "-r", "--name-only", "HEAD"], indexEnv)
    const caseMap = new Map<string, string>()
    if (headTree.success) {
      for (const p of headTree.stdout.split("\n").filter(Boolean)) {
        caseMap.set(p.toLowerCase(), p)
      }
    }

    let hasCaseRenames = false
    for (const file of files) {
      const fileExists = ports.fs.exists(file)
      const isTracked = ports.git.run(["ls-tree", "--name-only", "HEAD", "--", file]).stdout !== ""

      if (!fileExists && !isTracked) {
        const allFiles = ports.git.run(["ls-files"]).stdout
        const basename = file.split("/").pop() ?? file
        const similar = allFiles
          .split("\n")
          .filter((f) => f.toLowerCase().includes(basename.toLowerCase()))
          .slice(0, 3)

        const hints = ["file may have been moved, renamed, or never created"]
        if (similar.length > 0 && similar[0]) {
          hints.push("similar tracked files:")
          similar.forEach((f) => hints.push(`  ${f}`))
        }
        fail("file_not_found", `file not found and not tracked: ${file}`, hints)
      }

      if (fileExists) {
        if (ports.git.checkIgnore(file)) {
          fail("file_ignored", `file is ignored by .gitignore: ${file}`, ["file matches a pattern in .gitignore"])
        }
      }

      const headPath = caseMap.get(file.toLowerCase())
      if (headPath && headPath !== file) {
        ports.git.run(["rm", "--cached", "--quiet", "--", headPath], indexEnv)
        hasCaseRenames = true
      }

      const addResult = ports.git.run(["add", "--", file], indexEnv)
      if (!addResult.success) {
        fail("stage_failed", `failed to stage file: ${file}`, [addResult.stderr])
      }
    }

    if (!hasCaseRenames) {
      const diffResult = ports.git.run(["diff", "--cached", "--quiet"], indexEnv)
      if (diffResult.success) {
        fail("no_changes", "no changes to commit in specified files", ["file contents match what is already in HEAD"])
      }
    }

    const commitResult = ports.git.run(["commit", "-m", message, "--quiet"], indexEnv)
    if (!commitResult.success) {
      fail("commit_failed", "commit failed", [commitResult.stderr])
    }

    const hash = ports.git.run(["rev-parse", "--short", "HEAD"], indexEnv).stdout.trim()
    const committedFiles = ports.git
      .run(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], indexEnv)
      .stdout.split("\n")
      .filter(Boolean)

    ports.git.run(["reset", "--quiet", "HEAD"])

    return { hash, message, files: committedFiles }
  } finally {
    if (ports.fs.exists(tempIndex)) {
      ports.fs.unlink(tempIndex)
    }
  }
}
