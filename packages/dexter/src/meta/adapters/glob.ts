/**
 * GlobPort adapter — wraps minimatch for pattern matching.
 */

import { minimatch } from "minimatch"

import type { GlobPort } from "../ports.ts"

export function createNodeGlob(): GlobPort {
  return {
    match(pattern, candidates) {
      return candidates.filter((file) => minimatch(file, pattern, { dot: true }))
    },
  }
}
