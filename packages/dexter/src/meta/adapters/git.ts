/**
 * GitPort adapter — wraps child_process.spawnSync for git operations.
 */

import { spawnSync } from "node:child_process"

import type { GitPort } from "../ports.ts"

export function createNodeGit(): GitPort {
  return {
    run(args, env) {
      const result = spawnSync("git", args, {
        encoding: "utf8",
        env: env ? { ...process.env, ...env } : undefined,
      })
      return {
        success: result.status === 0 && result.error === undefined,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      }
    },
    checkIgnore(file) {
      const result = spawnSync("git", ["check-ignore", "-q", "--", file], {
        encoding: "utf8",
      })
      return result.status === 0 && result.error === undefined
    },
  }
}
