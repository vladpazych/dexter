/**
 * Adapter wiring — creates RepoPorts from real implementations.
 */

import { tmpdir } from "node:os"

import type { RepoPorts } from "../ports.ts"

import { createNodeGit } from "./git.ts"
import { createNodeFs } from "./fs.ts"
import { createNodeGlob } from "./glob.ts"
import { createNodeProcess } from "./process.ts"

export function createRepoPorts(root: string): RepoPorts {
  return {
    git: createNodeGit(),
    fs: createNodeFs(),
    process: createNodeProcess(),
    glob: createNodeGlob(),
    tmpdir: () => tmpdir(),
    root,
  }
}
