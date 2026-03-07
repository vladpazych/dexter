/**
 * Git bisect — automated binary search for the first bad commit.
 */

import type { ControlPorts } from "../ports.ts"
import type { BisectMatch, GitResult } from "../types.ts"
import { ControlError } from "../errors.ts"

const DEFAULT_TIMEOUT = 5 * 60 * 1000

/** Parse the first-bad-commit output from git bisect run. */
function parseFirstBad(output: string, ports: ControlPorts): BisectMatch {
  const match = output.match(/([0-9a-f]{40}) is the first bad commit/)
  if (!match) {
    throw new ControlError("bisect_inconclusive", "bisect did not identify a bad commit", [
      "The test command may not distinguish good from bad correctly",
      "Ensure the command exits 0 for good, non-zero for bad",
    ])
  }

  const fullHash = match[1]!
  const hash = fullHash.slice(0, 8)

  const show = ports.git.run(["show", "--format=%an%n%ai%n%s", "--stat", fullHash])
  const showLines = show.success ? show.stdout.split("\n").filter(Boolean) : []
  const author = showLines[0] ?? ""
  const rawDate = showLines[1] ?? ""
  const message = showLines[2] ?? ""

  let date: string
  try {
    date = new Date(rawDate).toISOString().slice(0, 10)
  } catch {
    date = rawDate
  }

  const diffResult = ports.git.run(["show", "--format=", "--patch", fullHash])
  const diff = diffResult.success ? diffResult.stdout.trim() : ""

  return { hash, author, date, message, diff }
}

export async function bisect(
  ports: ControlPorts,
  test: string,
  good: string,
  bad?: string,
  timeout?: number,
): Promise<GitResult> {
  if (!test) {
    throw new ControlError("empty_test", "bisect requires a test command", [
      "Usage: bisect <test-cmd> --good <ref>",
      "The command should exit 0 for good commits, non-zero for bad",
    ])
  }

  if (!good) {
    throw new ControlError("no_good_ref", "bisect requires a good (known-working) ref", [
      "Usage: bisect <test-cmd> --good <ref> [--bad <ref>]",
      'Example: bisect "bun test test/foo.test.ts" --good HEAD~20',
    ])
  }

  const badRef = bad ?? "HEAD"

  const goodCheck = ports.git.run(["rev-parse", "--verify", good])
  if (!goodCheck.success) {
    throw new ControlError("bad_ref", `invalid good ref: ${good}`, [
      `git rev-parse --verify ${good} failed`,
      "Use a commit hash, branch name, tag, or relative ref like HEAD~10",
    ])
  }

  if (bad) {
    const badCheck = ports.git.run(["rev-parse", "--verify", bad])
    if (!badCheck.success) {
      throw new ControlError("bad_ref", `invalid bad ref: ${bad}`, [`git rev-parse --verify ${bad} failed`])
    }
  }

  const bisectCheck = ports.git.run(["bisect", "log"])
  if (bisectCheck.success && bisectCheck.stdout.includes("git bisect start")) {
    throw new ControlError("bisect_active", "a bisect session is already in progress", [
      "Run `git bisect reset` to end the current session first",
    ])
  }

  try {
    const start = ports.git.run(["bisect", "start"])
    if (!start.success) {
      throw new ControlError("bisect_start_failed", `git bisect start failed: ${start.stderr.trim()}`, [])
    }

    const markBad = ports.git.run(["bisect", "bad", badRef])
    if (!markBad.success) {
      throw new ControlError("bisect_mark_failed", `git bisect bad ${badRef} failed: ${markBad.stderr.trim()}`, [])
    }

    const markGood = ports.git.run(["bisect", "good", good])
    if (!markGood.success) {
      throw new ControlError("bisect_mark_failed", `git bisect good ${good} failed: ${markGood.stderr.trim()}`, [])
    }

    const output = await new Promise<string>((resolve) => {
      const lines: string[] = []
      const handle = ports.process.spawn({
        cmd: "git",
        args: ["bisect", "run", "sh", "-c", test],
        cwd: ports.root,
        timeout: timeout ?? DEFAULT_TIMEOUT,
      })
      handle.onLine("stdout", (line) => lines.push(line))
      handle.onLine("stderr", (line) => lines.push(line))
      handle.wait().then((code) => {
        if (code === null) {
          lines.push("bisect timed out")
        }
        resolve(lines.join("\n"))
      })
    })

    return { what: "bisect", match: parseFirstBad(output, ports) }
  } finally {
    ports.git.run(["bisect", "reset"])
  }
}
