/**
 * GitPort adapter — wraps Bun.spawnSync for git operations.
 */

import type { GitPort } from "../ports.ts"

export function createBunGit(): GitPort {
  return {
    run(args, env) {
      const result = Bun.spawnSync(["git", ...args], {
        stdout: "pipe",
        stderr: "pipe",
        env: env ? { ...process.env, ...env } : undefined,
      })
      return {
        success: result.success,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
      }
    },
    checkIgnore(file) {
      const result = Bun.spawnSync(["git", "check-ignore", "-q", "--", file], {
        stdout: "pipe",
        stderr: "pipe",
      })
      return result.success
    },
  }
}
