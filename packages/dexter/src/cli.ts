/**
 * Dexter standalone CLI — scaffolding and utilities.
 *
 * Usage:
 *   dexter init          Scaffold meta/ + .claude/ in current repo
 *   dexter version       Print version
 */

import { version } from "./version.js"

const [, , cmd] = process.argv

switch (cmd) {
  case "init":
    console.log("dexter init — not yet implemented")
    break

  case "version":
  case "--version":
  case "-v":
    console.log(version)
    break

  case "--help":
  case "-h":
  case undefined:
    console.log(`dexter v${version} — agentic development toolkit

Usage: dexter <command>

Commands:
  init       Scaffold meta/ + .claude/ in current repo
  version    Print version`)
    break

  default:
    console.error(`Unknown command: ${cmd}`)
    process.exit(1)
}
