/**
 * FsPort adapter — wraps Node fs for file system operations.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync } from "node:fs"

import type { FsPort } from "../ports.ts"

export function createNodeFs(): FsPort {
  return {
    exists: (path) => existsSync(path),
    readFile: (path) => readFileSync(path, "utf-8"),
    writeFile: (path, content) => writeFileSync(path, content),
    readDir: (path) =>
      readdirSync(path, { withFileTypes: true }).map((d) => ({
        name: d.name,
        isDirectory: d.isDirectory(),
      })),
    unlink: (path) => unlinkSync(path),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
  }
}
