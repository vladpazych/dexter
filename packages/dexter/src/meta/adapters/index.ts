/**
 * Adapter wiring — creates ControlPorts from real implementations.
 */

import { homedir, tmpdir } from "node:os"

import type { ControlPorts } from "../ports.ts"

import { createBunGit } from "./git.ts"
import { createNodeFs } from "./fs.ts"
import { createNodeProcess } from "./process.ts"
import { createBunGlob } from "./glob.ts"

export function createControlPorts(root: string): ControlPorts {
  return {
    git: createBunGit(),
    fs: createNodeFs(),
    process: createNodeProcess(),
    glob: createBunGlob(),
    tmpdir: () => tmpdir(),
    homedir: () => homedir(),
    root,
  }
}
