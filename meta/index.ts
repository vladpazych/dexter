/**
 * Dexter repo meta — composition root.
 *
 * Dogfoods @vladpazych/dexter's own createCLI framework.
 * No custom commands yet — just core commands and hooks.
 */

// TODO: import { createCLI } from "@vladpazych/dexter/meta"
// For now, placeholder until the meta framework is built.

const [, , cmd] = process.argv

switch (cmd) {
  case undefined:
  case "--help":
  case "-h":
    console.log("dexter repo meta — not yet wired to framework")
    console.log("The meta framework is being built in packages/dexter/src/meta/")
    break

  default:
    // Pass through to hook handlers during development
    if (cmd.startsWith("on-")) {
      // Hooks: silent exit 0 (no handlers yet)
      process.exit(0)
    }
    console.error(`Unknown command: ${cmd}`)
    process.exit(1)
}
