/**
 * GlobPort adapter — wraps Bun.Glob for pattern matching.
 */

import type { GlobPort } from "../ports.ts"

export function createBunGlob(): GlobPort {
  return {
    match(pattern, candidates) {
      const glob = new Bun.Glob(pattern)
      return candidates.filter((f) => glob.match(f))
    },
  }
}
