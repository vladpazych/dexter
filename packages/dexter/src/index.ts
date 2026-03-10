/**
 * @vladpazych/dexter — self-describing repo command primitives and tooling helpers.
 *
 * Subpath exports:
 *   dexter/cli      — self-describing repo command runtime and helpers
 *   dexter/env      — env file loading
 *   dexter/pipe     — pipe utilities
 *   dexter/skills   — remote skill sync primitives
 *   dexter/spec     — config-driven spec file resolution
 *   dexter/terminal — terminal helpers
 */

export { version } from "./version.ts"

// Re-export top-level env utilities for convenience
export { applyEnv, loadEnv } from "./env/index.ts"
