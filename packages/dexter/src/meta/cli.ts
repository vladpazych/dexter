/**
 * createCLI — self-describing repo command runtime.
 */

import { z, type ZodTypeAny } from "zod"

import { resolveConfig as resolveEnvConfig, type ConfigFieldReport, type ConfigLoadReport, type ConfigOutput, type Schema } from "../env/define.ts"
import { createRepoPorts } from "./adapters/index.ts"
import { DexterError, isDexterError } from "./errors.ts"
import { parseFormat, type OutputMode } from "./lib/format.ts"
import { findRepoRoot } from "./lib/paths.ts"
import type { RepoPorts } from "./ports.ts"

type LoadEnvFn = {
  <const S extends Schema>(schema: S): ConfigOutput<S>
  <const S extends Schema>(name: string, schema: S): ConfigOutput<S>
}

export type CLIContext = {
  root: string
  ports: RepoPorts
  mode: OutputMode
  loadEnv: LoadEnvFn
}

export type CommandArg<TSchema extends ZodTypeAny = ZodTypeAny> = {
  name: string
  description: string
  schema: TSchema
}

export type CommandOption<TSchema extends ZodTypeAny = ZodTypeAny> = {
  description: string
  schema: TSchema
}

type CommandArgsShape = readonly CommandArg[]
type CommandOptionsShape = Record<string, CommandOption>

type InferArgs<TArgs extends CommandArgsShape> = {
  [TArg in TArgs[number] as TArg["name"]]: z.infer<TArg["schema"]>
}

type InferOptions<TOptions extends CommandOptionsShape> = {
  [TName in keyof TOptions]: z.infer<TOptions[TName]["schema"]>
}

export type CommandInput<
  TArgs extends CommandArgsShape = [],
  TOptions extends CommandOptionsShape = {},
> = {
  args: InferArgs<TArgs>
  options: InferOptions<TOptions>
}

export type CommandDefinition<
  TArgs extends CommandArgsShape = [],
  TOptions extends CommandOptionsShape = {},
  TResult = unknown,
> = {
  description: string
  args?: TArgs
  options?: TOptions
  run: (input: CommandInput<TArgs, TOptions>, ctx: CLIContext) => Promise<TResult> | TResult
  renderCli?: (result: TResult, ctx: CLIContext) => string
}

export type CommandBuilder<
  TArgs extends CommandArgsShape = [],
  TOptions extends CommandOptionsShape = {},
  TResult = unknown,
> = {
  description: (value: string) => CommandBuilder<TArgs, TOptions, TResult>
  args: <const TNextArgs extends CommandArgsShape>(...value: TNextArgs) => CommandBuilder<TNextArgs, TOptions, TResult>
  options: <const TNextOptions extends CommandOptionsShape>(value: TNextOptions) => CommandBuilder<TArgs, TNextOptions, TResult>
  run: <TNextResult>(
    handler: (input: CommandInput<TArgs, TOptions>, ctx: CLIContext) => Promise<TNextResult> | TNextResult,
  ) => CommandBuilder<TArgs, TOptions, TNextResult>
  renderCli: (handler: (result: TResult, ctx: CLIContext) => string) => CommandBuilder<TArgs, TOptions, TResult>
  build: () => RuntimeCommandDefinition
}

type RuntimeCommandInput = {
  args: Record<string, unknown>
  options: Record<string, unknown>
}

type RuntimeCommandDefinition = {
  description: string
  args?: CommandArgsShape
  options?: CommandOptionsShape
  run: (input: RuntimeCommandInput, ctx: CLIContext) => Promise<unknown> | unknown
  renderCli?: (result: unknown, ctx: CLIContext) => string
}

export type AnyCommand = RuntimeCommandDefinition
export type CommandNamespace = {
  description: string
  commands: Record<string, CommandNode>
}
export type CommandNode = AnyCommand | CommandNamespace

export type CLIConfig = {
  description?: string
  commands?: Record<string, CommandNode>
}

export function defineConfig(config: CLIConfig): CLIConfig {
  return config
}

export function args<const TArgs extends CommandArgsShape>(value: TArgs): TArgs {
  return value
}

export function command(): CommandBuilder
export function command<
  const TArgs extends CommandArgsShape = [],
  const TOptions extends CommandOptionsShape = {},
  TResult = unknown,
>(definition: CommandDefinition<TArgs, TOptions, TResult>): RuntimeCommandDefinition
export function command<
  const TArgs extends CommandArgsShape = [],
  const TOptions extends CommandOptionsShape = {},
  TResult = unknown,
>(definition?: CommandDefinition<TArgs, TOptions, TResult>): RuntimeCommandDefinition | CommandBuilder {
  if (definition === undefined) {
    return createCommandBuilder()
  }

  return definition as unknown as RuntimeCommandDefinition
}

type NormalizedOption = {
  key: string
  definition: CommandOption
}

type ResolvedCommand = {
  path: string[]
  node: CommandNode | undefined
  rest: string[]
}

type RuntimeMeta = {
  env: ConfigLoadReport[]
}

type BuilderState = {
  description?: string
  args?: CommandArgsShape
  options?: CommandOptionsShape
  run?: RuntimeCommandDefinition["run"]
  renderCli?: RuntimeCommandDefinition["renderCli"]
}

function createCommandBuilder<
  TArgs extends CommandArgsShape = [],
  TOptions extends CommandOptionsShape = {},
  TResult = unknown,
>(state: BuilderState = {}): CommandBuilder<TArgs, TOptions, TResult> {
  return {
    description(value) {
      return createCommandBuilder<TArgs, TOptions, TResult>({
        ...state,
        description: value,
      })
    },
    args<const TNextArgs extends CommandArgsShape>(...value: TNextArgs) {
      return createCommandBuilder<TNextArgs, TOptions, TResult>({
        ...state,
        args: value,
      })
    },
    options<const TNextOptions extends CommandOptionsShape>(value: TNextOptions) {
      return createCommandBuilder<TArgs, TNextOptions, TResult>({
        ...state,
        options: value,
      })
    },
    run<TNextResult>(
      handler: (input: CommandInput<TArgs, TOptions>, ctx: CLIContext) => Promise<TNextResult> | TNextResult,
    ) {
      return createCommandBuilder<TArgs, TOptions, TNextResult>({
        ...state,
        run: handler as RuntimeCommandDefinition["run"],
      })
    },
    renderCli(handler: (result: TResult, ctx: CLIContext) => string) {
      return createCommandBuilder<TArgs, TOptions, TResult>({
        ...state,
        renderCli: handler as RuntimeCommandDefinition["renderCli"],
      })
    },
    build() {
      if (state.description === undefined) {
        throw new Error("command builder requires description() before build()")
      }

      if (state.run === undefined) {
        throw new Error("command builder requires run() before build()")
      }

      return {
        description: state.description,
        args: state.args,
        options: state.options,
        run: state.run,
        renderCli: state.renderCli,
      }
    },
  }
}

function outputError(err: unknown): number {
  if (isDexterError(err)) {
    console.error(`error: ${err.message}`)
    for (const hint of err.hints) {
      console.error(`hint: ${hint}`)
    }
  } else {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
  }
  return 1
}

function isOptionalSchema(schema: ZodTypeAny): boolean {
  return schema.safeParse(undefined).success
}

function isBooleanSchema(schema: ZodTypeAny): boolean {
  return schema.safeParse(true).success && schema.safeParse(false).success
}

function toFlagName(name: string): string {
  return name.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

function buildOptionIndex(options: CommandOptionsShape): Map<string, NormalizedOption> {
  const index = new Map<string, NormalizedOption>()

  for (const [key, definition] of Object.entries(options)) {
    index.set(key, { key, definition })
    index.set(toFlagName(key), { key, definition })
  }

  return index
}

function formatIssue(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : ""
      return `${path}${issue.message}`
    })
    .join("; ")
}

function parseBooleanValue(raw: string): boolean | undefined {
  if (raw === "true") return true
  if (raw === "false") return false
  return undefined
}

function isNamespaceNode(node: CommandNode | undefined): node is CommandNamespace {
  return typeof node === "object" && node !== null && "commands" in node && !("run" in node)
}

function resolveCommand(tokens: string[], commands: Record<string, CommandNode> = {}): ResolvedCommand {
  const path: string[] = []
  let entries = commands
  let node: CommandNode | undefined

  for (const token of tokens) {
    const next = entries[token]
    if (!next) {
      break
    }

    path.push(token)
    node = next

    if (isNamespaceNode(next)) {
      entries = next.commands
      continue
    }

    return {
      path,
      node: next,
      rest: tokens.slice(path.length),
    }
  }

  return {
    path,
    node,
    rest: tokens.slice(path.length),
  }
}

function formatPath(path: string[]): string {
  return path.join(" ")
}

function createLoadEnv(root: string, reports: ConfigLoadReport[]): LoadEnvFn {
  const options = {
    rootDir: root,
    env: process.env,
  }

  function record<const S extends Schema>(result: {
    config: ConfigOutput<S>
    report: ConfigLoadReport
  }): ConfigOutput<S> {
    reports.push(result.report)
    return result.config
  }

  function loadEnv<const S extends Schema>(schema: S): ConfigOutput<S>
  function loadEnv<const S extends Schema>(name: string, schema: S): ConfigOutput<S>
  function loadEnv<const S extends Schema>(nameOrSchema: string | S, maybeSchema?: S): ConfigOutput<S> {
    if (typeof nameOrSchema === "string") {
      if (maybeSchema === undefined) {
        throw new Error("schema is required when name is provided")
      }

      return record(resolveEnvConfig(nameOrSchema, maybeSchema, options))
    }

    return record(resolveEnvConfig(nameOrSchema, options))
  }

  return loadEnv
}

function formatEnvField(field: ConfigFieldReport, width: number): string {
  const source = `[${field.source}]`
  const padding = " ".repeat(Math.max(width - field.env.length + 2, 2))
  return `    ${field.env}${padding}${field.displayValue} ${source}`
}

function formatRuntimeMeta(meta: RuntimeMeta): string | undefined {
  if (meta.env.length === 0) {
    return undefined
  }

  const lines = ["Environment:"]

  for (const report of meta.env) {
    lines.push(`  ${report.name}`)
    const width = report.fields.reduce((max, field) => Math.max(max, field.env.length), 0)
    for (const field of report.fields) {
      lines.push(formatEnvField(field, width))
    }
  }

  return lines.join("\n")
}

function parseCommandInput(commandName: string, definition: AnyCommand, tokens: string[]): RuntimeCommandInput {
  const argDefs = definition.args ?? []
  const optionDefs = definition.options ?? {}
  const optionIndex = buildOptionIndex(optionDefs)
  const rawOptions = new Map<string, unknown>()
  const positionals: string[] = []
  let stopOptions = false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!

    if (!stopOptions && token === "--") {
      stopOptions = true
      continue
    }

    if (!stopOptions && token.startsWith("--") && token.length > 2) {
      if (token.startsWith("--no-")) {
        const normalized = optionIndex.get(token.slice("--no-".length))
        if (!normalized || !isBooleanSchema(normalized.definition.schema)) {
          throw new DexterError("unknown-option", `Unknown option: ${token}`)
        }
        rawOptions.set(normalized.key, false)
        continue
      }

      const eqIndex = token.indexOf("=")
      const rawName = eqIndex >= 0 ? token.slice(2, eqIndex) : token.slice(2)
      const normalized = optionIndex.get(rawName)
      if (!normalized) {
        throw new DexterError("unknown-option", `Unknown option: --${rawName}`)
      }

      if (eqIndex >= 0) {
        const inlineValue = token.slice(eqIndex + 1)
        const value = isBooleanSchema(normalized.definition.schema)
          ? (parseBooleanValue(inlineValue) ?? inlineValue)
          : inlineValue
        rawOptions.set(normalized.key, value)
        continue
      }

      if (isBooleanSchema(normalized.definition.schema)) {
        rawOptions.set(normalized.key, true)
        continue
      }

      const next = tokens[i + 1]
      if (next === undefined || next === "--" || next.startsWith("--")) {
        throw new DexterError("missing-option-value", `Missing value for option: --${toFlagName(normalized.key)}`)
      }

      rawOptions.set(normalized.key, next)
      i++
      continue
    }

    positionals.push(token)
  }

  if (positionals.length > argDefs.length) {
    throw new DexterError(
      "unexpected-argument",
      `Unexpected argument: ${positionals[argDefs.length]!}`,
      [`Usage: ${formatUsage(commandName, definition)}`],
    )
  }

  const args: Record<string, unknown> = {}
  for (let index = 0; index < argDefs.length; index++) {
    const arg = argDefs[index]!
    const rawValue = positionals[index]
    const parsed = arg.schema.safeParse(rawValue)

    if (!parsed.success) {
      if (rawValue === undefined && !isOptionalSchema(arg.schema)) {
        throw new DexterError(
          "missing-argument",
          `Missing required argument: ${arg.name}`,
          [`Usage: ${formatUsage(commandName, definition)}`],
        )
      }

      throw new DexterError(
        "invalid-argument",
        `Invalid value for argument '${arg.name}': ${formatIssue(parsed.error)}`,
      )
    }

    args[arg.name] = parsed.data
  }

  const options: Record<string, unknown> = {}
  for (const [key, option] of Object.entries(optionDefs)) {
    const rawValue = rawOptions.has(key) ? rawOptions.get(key) : undefined
    const parsed = option.schema.safeParse(rawValue)

    if (!parsed.success) {
      if (rawValue === undefined && !isOptionalSchema(option.schema)) {
        throw new DexterError("missing-option", `Missing required option: --${toFlagName(key)}`)
      }

      throw new DexterError(
        "invalid-option",
        `Invalid value for option '--${toFlagName(key)}': ${formatIssue(parsed.error)}`,
      )
    }

    options[key] = parsed.data
  }

  return { args, options }
}

function renderResult(result: unknown, definition: AnyCommand, ctx: CLIContext, meta: RuntimeMeta): string | undefined {
  if (ctx.mode === "json") {
    if (meta.env.length === 0) {
      if (result === undefined) return undefined
      return JSON.stringify(result, null, 2)
    }

    const payload: Record<string, unknown> = {
      meta: {
        env: meta.env,
      },
    }
    if (result !== undefined) {
      payload.result = result
    }
    return JSON.stringify(payload, null, 2)
  }

  const sections: string[] = []
  const formattedMeta = formatRuntimeMeta(meta)
  if (formattedMeta !== undefined) {
    sections.push(formattedMeta)
  }

  let renderedResult: string | undefined
  if (definition.renderCli) {
    renderedResult = definition.renderCli(result, ctx)
  } else if (typeof result === "string") {
    renderedResult = result
  } else if (result !== undefined) {
    renderedResult = JSON.stringify(result, null, 2)
  }

  if (renderedResult !== undefined && renderedResult.length > 0) {
    sections.push(renderedResult)
  }

  if (sections.length === 0) {
    return undefined
  }

  return sections.join("\n\n")
}

function printText(text: string | undefined): void {
  if (text === undefined || text.length === 0) {
    return
  }
  console.log(text)
}

function formatUsage(commandName: string, definition: AnyCommand): string {
  const args = (definition.args ?? []).map((arg) =>
    isOptionalSchema(arg.schema) ? `[${arg.name}]` : `<${arg.name}>`,
  )
  const optionDefs = definition.options ?? {}
  const hasOptions = Object.keys(optionDefs).length > 0
  const parts = ["dexter", commandName]

  if (hasOptions) {
    parts.push("[options]")
  }
  parts.push(...args)

  return parts.join(" ")
}

function formatCommandHelp(commandName: string, definition: AnyCommand): string {
  const lines = [definition.description, "", `Usage: ${formatUsage(commandName, definition)}`]
  const args = definition.args ?? []
  const options = definition.options ?? {}

  if (args.length > 0) {
    lines.push("", "Arguments:")
    for (const arg of args) {
      const suffix = isOptionalSchema(arg.schema) ? " (optional)" : ""
      lines.push(`  ${arg.name}${suffix}  ${arg.description}`)
    }
  }

  lines.push("", "Options:")
  const optionKeys = Object.keys(options).sort()
  if (optionKeys.length === 0) {
    lines.push("  (none)")
  } else {
    for (const key of optionKeys) {
      const option = options[key]!
      const flag = `--${toFlagName(key)}`
      const label = isBooleanSchema(option.schema) ? flag : `${flag} <value>`
      const suffix = isOptionalSchema(option.schema) ? " (optional)" : ""
      lines.push(`  ${label}${suffix}  ${option.description}`)
    }
  }

  lines.push("  -h, --help  Show command help")
  lines.push("  --json      Print JSON output")
  lines.push("  --format <cli|json>  Select output mode")

  return lines.join("\n")
}

function formatNamespaceHelp(path: string[], definition: CommandNamespace): string {
  const commandName = formatPath(path)
  const lines = [definition.description, "", `Usage: dexter ${commandName} <command>`, "", "Commands:"]
  const entries = Object.entries(definition.commands).sort(([left], [right]) => left.localeCompare(right))

  if (entries.length === 0) {
    lines.push("  (none)")
  } else {
    for (const [name, child] of entries) {
      lines.push(`  ${name}  ${child.description}`)
    }
  }

  lines.push("", "Options:")
  lines.push("  -h, --help  Show command help")

  return lines.join("\n")
}

function formatGlobalHelp(config: CLIConfig): string {
  const title = config.description ?? "dexter meta"
  const lines = [title, "", "Usage: dexter <command...>", "", "Commands:"]
  const entries = Object.entries(config.commands ?? {}).sort(([left], [right]) => left.localeCompare(right))

  if (entries.length === 0) {
    lines.push("  (none)")
  } else {
    for (const [name, definition] of entries) {
      lines.push(`  ${name}  ${definition.description}`)
    }
  }

  lines.push("", "Global flags:")
  lines.push("  --json")
  lines.push("  --format <cli|json>")
  lines.push("  -h, --help")

  return lines.join("\n")
}

export function createCLI(config: CLIConfig = {}) {
  return {
    async run(argv: string[] = process.argv.slice(2)): Promise<number> {
      const [cmd, ...rawArgs] = argv

      if (cmd === undefined || cmd === "help" || cmd === "--help" || cmd === "-h") {
        const { rest } = parseFormat(rawArgs)
        if (rest.length === 0) {
          printText(formatGlobalHelp(config))
          return 0
        }

        const resolved = resolveCommand(rest, config.commands)
        const fullPath = formatPath([...resolved.path, ...resolved.rest])
        if (resolved.node === undefined || resolved.rest.length > 0) {
          console.error(`Unknown command: ${fullPath}`)
          return 1
        }

        if (isNamespaceNode(resolved.node)) {
          printText(formatNamespaceHelp(resolved.path, resolved.node))
          return 0
        }

        printText(formatCommandHelp(formatPath(resolved.path), resolved.node))
        return 0
      }

      const resolved = resolveCommand(argv, config.commands)
      const invokedPath = formatPath([...resolved.path, ...resolved.rest])

      if (resolved.node === undefined) {
        console.error(`Unknown command: ${cmd}`)
        return 1
      }

      try {
        const { mode, rest } = parseFormat(resolved.rest)

        if (isNamespaceNode(resolved.node)) {
          if (rest.length === 0 || rest.includes("--help") || rest.includes("-h")) {
            printText(formatNamespaceHelp(resolved.path, resolved.node))
            return 0
          }

          console.error(`Unknown command: ${invokedPath}`)
          return 1
        }

        if (rest.includes("--help") || rest.includes("-h")) {
          printText(formatCommandHelp(formatPath(resolved.path), resolved.node))
          return 0
        }

        const root = findRepoRoot()
        const ports = createRepoPorts(root)
        const meta: RuntimeMeta = { env: [] }
        const ctx: CLIContext = { root, ports, mode, loadEnv: createLoadEnv(root, meta.env) }
        const input = parseCommandInput(formatPath(resolved.path), resolved.node, rest)
        const result = await resolved.node.run(input, ctx)
        printText(renderResult(result, resolved.node, ctx, meta))
        return 0
      } catch (err) {
        return outputError(err)
      }
    },
  }
}
