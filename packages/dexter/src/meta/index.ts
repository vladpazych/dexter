/**
 * CLI framework — self-describing repo command runtime.
 */

export { args, command, createCLI, defineConfig } from "./cli.ts"
export type {
  AnyCommand,
  CLIConfig,
  CLIContext,
  CommandArg,
  CommandBuilder,
  CommandDefinition,
  CommandInput,
  CommandNamespace,
  CommandNode,
  CommandOption,
} from "./cli.ts"

// Adapters (for custom commands that need low-level port access)
export { createRepoPorts } from "./adapters/index.ts"

// Error handling
export { DexterError, isDexterError } from "./errors.ts"

// Utilities for custom commands
export { parseFormat } from "./lib/format.ts"
export type { OutputMode, ParsedFormat } from "./lib/format.ts"
export { findRepoRoot, isInsideRepo } from "./lib/paths.ts"
export { discoverPackages, filterByFiles, filterByScope, filterByScript } from "./domain/workspace.ts"
export type { WorkspacePackage } from "./domain/workspace.ts"
export type { RepoPorts, GitPort, FsPort, ProcessPort, GlobPort } from "./ports.ts"
