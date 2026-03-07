/**
 * Meta framework — createCLI factory, hook protocol, domain commands.
 *
 * Consumer repos use this to wire project-specific commands and hook extensions
 * on top of the universal agentic development toolkit.
 */

// Factory
export { createCLI } from "./cli.ts"
export type { CLIConfig, HookContext, HookOutput, DenyPattern } from "./cli.ts"

// Adapters (for custom commands that need low-level port access)
export { createControlPorts } from "./adapters/index.ts"

// Error handling
export { ControlError, isControlError } from "./errors.ts"

// Utilities for custom commands
export { parseFormat } from "./lib/format.ts"
export type { ParsedFormat } from "./lib/format.ts"
export { findRepoRoot } from "./lib/paths.ts"
export { getActor, isLLM, isHuman } from "./lib/actor.ts"

// Types
export type { HookInput } from "./lib/stdin.ts"
export type {
  CommitParams,
  CommitResult,
  QueryResult,
  GitResult,
  Package,
  EvalParams,
  EvalResult,
  SetupResult,
  TranscriptsParams,
  TranscriptsResult,
} from "./types.ts"
export type { ControlPorts, GitPort, FsPort, ProcessPort, GlobPort } from "./ports.ts"
export type { ControlService } from "./domain/service.ts"
