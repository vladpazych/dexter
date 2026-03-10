/**
 * Adapter wiring — creates RepoPorts from real implementations.
 */

import { tmpdir } from "node:os"

import type { RepoPorts } from "../ports.ts"

import { createBunGit } from "./git.ts"
import { createNodeFs } from "./fs.ts"
import { createNodeProcess } from "./process.ts"
import { createBunGlob } from "./glob.ts"

export function createRepoPorts(root: string): RepoPorts {
  return {
    git: createBunGit(),
    fs: createNodeFs(),
    process: createNodeProcess(),
    glob: createBunGlob(),
    tmpdir: () => tmpdir(),
    root,
  }
}
