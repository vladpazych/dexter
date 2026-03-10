/**
 * FsPort adapter — wraps Node fs for file system operations.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"

import type { FsPort } from "../ports.ts"

export function createNodeFs(): FsPort {
  return {
    exists: (path) => existsSync(path),
    readFile: (path) => readFileSync(path, "utf-8"),
    writeFile: (path, content) => writeFileSync(path, content),
    readBytes: (path) => new Uint8Array(readFileSync(path)),
    writeBytes: (path, content) => writeFileSync(path, content),
    readDir: (path) =>
      readdirSync(path, { withFileTypes: true }).map((d) => ({
        name: d.name,
        isDirectory: d.isDirectory(),
      })),
    unlink: (path) => unlinkSync(path),
    rmdir: (path) => rmdirSync(path),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
    rename: (from, to) => renameSync(from, to),
  }
}
